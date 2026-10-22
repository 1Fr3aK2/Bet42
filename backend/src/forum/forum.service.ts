import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateReportDto } from './dto/create-report.dto';
import { ResolveReportDto } from './dto/resolve-report.dto';
import { ModerationService } from '../moderation/moderation.service';
import { ReviewContentDto } from './dto/review-content.dto';
import { SearchPostsDto } from './dto/search-posts.dto';
import { Prisma } from '@prisma/client';
import { RateLimiterService } from '../rate-limiter/rate-limiter.service';

@Injectable()
export class ForumService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderationService: ModerationService,
    private readonly rateLimiter: RateLimiterService,
  ) {}

  async findAllPosts(query: SearchPostsDto) {
    if (
      query.dateFrom &&
      query.dateTo &&
      new Date(query.dateFrom) > new Date(query.dateTo)
    ) {
      throw new BadRequestException(
        'dateFrom must be earlier than or equal to dateTo',
      );
    }
    const sortBy = query.sortBy ?? 'createdAt';
    const order = query.order ?? 'desc';
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.PostWhereInput = {
      status: 'visible',

      ...(query.search && {
        OR: [
          {
            title: {
              contains: query.search,
              mode: 'insensitive',
            },
          },
          {
            content: {
              contains: query.search,
              mode: 'insensitive',
            },
          },
        ],
      }),

      ...(query.authorId && {
        authorId: query.authorId,
      }),

      ...((query.dateFrom || query.dateTo) && {
        createdAt: {
          ...(query.dateFrom && {
            gte: new Date(query.dateFrom),
          }),
          ...(query.dateTo && {
            lte: new Date(query.dateTo),
          }),
        },
      }),
    };

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        orderBy: {
          [sortBy]: order,
        },
        skip,
        take: limit,
      }),

      this.prisma.post.count({
        where,
      }),
    ]);

    return {
      data: posts,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  findPostById(id: number) {
    return this.prisma.post.findUnique({
      where: { id },
    });
  }

  async createPost(createPostDto: CreatePostDto, userId: number) {
    const allowed = await this.rateLimiter.checkLimit(
      `forum_post:${userId}`,
      5,
      600,
    );
    if (!allowed) {
      throw new HttpException(
        'You are posting too frequently. Please wait before creating another post.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const textToAnalyze =
      `${createPostDto.title}\n${createPostDto.content}`;

    const moderation =
      this.moderationService.analyzeText(textToAnalyze);

    if (moderation.decision === 'rejected') {
      throw new BadRequestException({
        message: 'Post rejected by automatic moderation',
        moderation,
      });
    }

    const status =
      moderation.decision === 'flagged'
        ? 'pending'
        : 'visible';

    return this.prisma.post.create({
      data: {
        title: createPostDto.title,
        content: createPostDto.content,
        status,
        moderationDecision: moderation.decision,
        moderationScore: moderation.score,
        moderationReasons: moderation.reasons,
        authorId: userId,
      },
    });
  }

  async updatePost(
    id: number,
    updatePostDto: UpdatePostDto,
    userId: number,
  ) {
    const post = await this.prisma.post.findUnique({
      where: { id },
    });

    if (!post) {
      throw new NotFoundException(
        `Post with id ${id} not found`,
      );
    }

    if (post.authorId !== userId) {
      throw new ForbiddenException(
        'You can only update your own posts',
      );
    }

    if (post.status === 'removed') {
      throw new ConflictException(
        'Removed posts cannot be edited',
      );
    }

    const updatedTitle =
      updatePostDto.title ?? post.title;

    const updatedContent =
      updatePostDto.content ?? post.content;

    const textToAnalyze =
      `${updatedTitle}\n${updatedContent}`;

    const moderation =
      this.moderationService.analyzeText(textToAnalyze);

    if (moderation.decision === 'rejected') {
      throw new BadRequestException({
        message: 'Post rejected by automatic moderation',
        moderation,
      });
    }

    const status =
      moderation.decision === 'flagged'
        ? 'pending'
        : 'visible';

    return this.prisma.post.update({
      where: { id },
      data: {
        ...updatePostDto,
        status,
        moderationDecision: moderation.decision,
        moderationScore: moderation.score,
        moderationReasons: moderation.reasons,
      },
    });
  }

  async deletePost(
    id: number,
    userId: number,
  ) {
    const post = await this.prisma.post.findUnique({
      where: { id },
    });

    if (!post) {
      throw new NotFoundException(
        `Post with id ${id} not found`,
      );
    }

    if (post.authorId !== userId) {
      throw new ForbiddenException(
        'You can only delete your own posts',
      );
    }

    return this.prisma.post.delete({
      where: { id },
    });
  }

  async createComment(
    postId: number,
    createCommentDto: CreateCommentDto,
    userId: number,
  ) {
    const allowed = await this.rateLimiter.checkLimit(
      `forum_comment:${userId}`,
      20,
      600,
    );
    if (!allowed) {
      throw new HttpException(
        'You are commenting too frequently. Please wait before commenting again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const post = await this.prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException(
        `Post with id ${postId} not found`,
      );
    }

    if (post.status !== 'visible') {
      throw new ConflictException(
        'Comments cannot be added to this post',
      );
    }

    const moderation = this.moderationService.analyzeText(
      createCommentDto.content,
    );

    if (moderation.decision === 'rejected') {
      throw new BadRequestException({
        message: 'Comment rejected by automatic moderation',
        moderation,
      });
    }

    const status =
      moderation.decision === 'flagged'
        ? 'pending'
        : 'visible';

    return this.prisma.comment.create({
      data: {
        content: createCommentDto.content,
        postId,
        status,
        moderationDecision: moderation.decision,
        moderationScore: moderation.score,
        moderationReasons: moderation.reasons,
        authorId: userId,
      },
    });
  }

  findCommentsByPost(postId: number) {
    return this.prisma.comment.findMany({
      where: {
        postId,
        status: 'visible',
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async updateComment(
    id: number,
    updateCommentDto: UpdateCommentDto,
    userId: number,
  ) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
    });

    if (!comment) {
      throw new NotFoundException(
        `Comment with id ${id} not found`,
      );
    }

    if (comment.authorId !== userId) {
      throw new ForbiddenException(
        'You can only update your own comments',
      );
    }

    if (comment.status === 'removed') {
      throw new ConflictException(
        'Removed comments cannot be edited',
      );
    }

    const updatedContent =
      updateCommentDto.content ?? comment.content;

    const moderation =
      this.moderationService.analyzeText(updatedContent);

    if (moderation.decision === 'rejected') {
      throw new BadRequestException({
        message: 'Comment rejected by automatic moderation',
        moderation,
      });
    }

    const status =
      moderation.decision === 'flagged'
        ? 'pending'
        : 'visible';

    return this.prisma.comment.update({
      where: { id },
      data: {
        ...updateCommentDto,
        status,
        moderationDecision: moderation.decision,
        moderationScore: moderation.score,
        moderationReasons: moderation.reasons,
      },
    });
  }

  async deleteComment(
    id: number,
    userId: number,
  ) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
    });

    if (!comment) {
      throw new NotFoundException(
        `Comment with id ${id} not found`,
      );
    }

    if (comment.authorId !== userId) {
      throw new ForbiddenException(
        'You can only delete your own comments',
      );
    }

    return this.prisma.comment.delete({
      where: { id },
    });
  }

  async createReport(createReportDto: CreateReportDto, userId: number) {
    const allowed = await this.rateLimiter.checkLimit(
      `forum_report:${userId}`,
      10,
      3600,
    );
    if (!allowed) {
      throw new HttpException(
        'You are submitting too many reports. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (createReportDto.targetType === 'post') {
      const post = await this.prisma.post.findUnique({
        where: { id: createReportDto.targetId },
      });

      if (!post) {
        throw new NotFoundException(
          `Post with id ${createReportDto.targetId} not found`,
        );
      }

      if (post.status !== 'visible') {
        throw new ConflictException(
          'This post is no longer available for reporting',
        );
      }
    }

    if (createReportDto.targetType === 'comment') {
      const comment = await this.prisma.comment.findUnique({
        where: { id: createReportDto.targetId },
      });

      if (!comment) {
        throw new NotFoundException(
          `Comment with id ${createReportDto.targetId} not found`,
        );
      }

      if (comment.status !== 'visible') {
        throw new ConflictException(
          'This comment is no longer available for reporting',
        );
      }
    }

    const existingReport = await this.prisma.report.findFirst({
      where: {
        reporterId: userId,
        targetType: createReportDto.targetType,
        targetId: createReportDto.targetId,
        status: 'pending',
      },
    });

    if (existingReport) {
      throw new ConflictException(
        'You already have a pending report for this content',
      );
    }

    return this.prisma.report.create({
      data: {
        targetType: createReportDto.targetType,
        targetId: createReportDto.targetId,
        reason: createReportDto.reason,
        reporterId: userId,
      },
    });
  }

  async findAllReports(status?: string) {
    const reports = await this.prisma.report.findMany({
      where: status
        ? {
            status,
          }
        : undefined,
      orderBy: {
        createdAt: 'desc',
      },
    });

    const postIds = reports
      .filter((r) => r.targetType === 'post')
      .map((r) => r.targetId);
    const commentIds = reports
      .filter((r) => r.targetType === 'comment')
      .map((r) => r.targetId);

    const [posts, comments] = await Promise.all([
      this.prisma.post.findMany({
        where: { id: { in: postIds } },
        select: {
          id: true,
          title: true,
          content: true,
          status: true,
          authorId: true,
          createdAt: true,
        },
      }),
      this.prisma.comment.findMany({
        where: { id: { in: commentIds } },
        select: {
          id: true,
          content: true,
          status: true,
          authorId: true,
          postId: true,
          createdAt: true,
        },
      }),
    ]);

    const userIds = new Set<number>();
    for (const r of reports) {
      userIds.add(r.reporterId);
      if (r.moderatorId) userIds.add(r.moderatorId);
    }
    for (const p of posts) userIds.add(p.authorId);
    for (const c of comments) userIds.add(c.authorId);

    const users = await this.prisma.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: { id: true, username: true },
    });

    const usernames = new Map(users.map((u) => [u.id, u.username] as const));
    const postsById = new Map(posts.map((p) => [p.id, p] as const));
    const commentsById = new Map(comments.map((c) => [c.id, c] as const));

    // Each report is returned with the content it points to, so moderators
    // can review it without extra requests. `target` is null when the
    // content no longer exists (its author deleted it).
    return reports.map((r) => {
      const target =
        r.targetType === 'post'
          ? postsById.get(r.targetId)
          : commentsById.get(r.targetId);

      return {
        ...r,
        reporterUsername: usernames.get(r.reporterId) ?? null,
        moderatorUsername: r.moderatorId
          ? (usernames.get(r.moderatorId) ?? null)
          : null,
        target: target
          ? {
              ...target,
              authorUsername: usernames.get(target.authorId) ?? null,
            }
          : null,
      };
    });
  }

  async resolveReport(
    reportId: number,
    resolveReportDto: ResolveReportDto,
    moderatorId: number,
  ) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException(
        `Report with id ${reportId} not found`,
      );
    }

    if (report.status !== 'pending') {
      throw new BadRequestException(
        `Report with id ${reportId} has already been resolved`,
      );
    }

    if (report.targetType === 'post') {
      const post = await this.prisma.post.findUnique({
        where: { id: report.targetId },
      });

      // The author may have deleted the post after it was reported. The
      // report can still be closed; there is just nothing left to remove.
      if (post && resolveReportDto.action === 'remove') {
        await this.prisma.post.update({
          where: { id: report.targetId },
          data: { status: 'removed' },
        });
      }
    }

    if (report.targetType === 'comment') {
      const comment = await this.prisma.comment.findUnique({
        where: { id: report.targetId },
      });

      // Same as above: the comment may already have been deleted.
      if (comment && resolveReportDto.action === 'remove') {
        await this.prisma.comment.update({
          where: { id: report.targetId },
          data: { status: 'removed' },
        });
      }
    }

    const updatedReport = await this.prisma.report.update({
      where: { id: reportId },
      data: {
        status: 'resolved',
        resolution: resolveReportDto.action,
        moderatorId: moderatorId,
        moderatorNote: resolveReportDto.note,
        reviewedAt: new Date(),
      },
    });

    await this.prisma.moderationLog.create({
      data: {
        reportId,
        targetType: report.targetType,
        targetId: report.targetId,
        action: resolveReportDto.action,
        reason: resolveReportDto.note,
        moderatorId: moderatorId,
      },
    });

    return updatedReport;
  }

  findAllModerationLogs() {
    return this.prisma.moderationLog.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // Posts and comments the automatic moderation flagged for human review.
  // Each item also carries the author's username (and, for comments, the title
  // of the post they belong to) so the moderation screen can show context.
  async findPendingContent() {
    const [posts, comments] = await Promise.all([
      this.prisma.post.findMany({
        where: {
          status: 'pending',
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),

      this.prisma.comment.findMany({
        where: {
          status: 'pending',
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ]);

    const userIds = [
      ...new Set([
        ...posts.map((p) => p.authorId),
        ...comments.map((c) => c.authorId),
      ]),
    ];
    const parentPostIds = [...new Set(comments.map((c) => c.postId))];

    const [users, parentPosts] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, username: true },
      }),
      this.prisma.post.findMany({
        where: { id: { in: parentPostIds } },
        select: { id: true, title: true },
      }),
    ]);

    const usernames = new Map(users.map((u) => [u.id, u.username] as const));
    const titles = new Map(parentPosts.map((p) => [p.id, p.title] as const));

    return {
      posts: posts.map((p) => ({
        ...p,
        authorUsername: usernames.get(p.authorId) ?? null,
      })),
      comments: comments.map((c) => ({
        ...c,
        authorUsername: usernames.get(c.authorId) ?? null,
        postTitle: titles.get(c.postId) ?? null,
      })),
    };
  }

  async reviewPendingPost(
    postId: number,
    reviewContentDto: ReviewContentDto,
    moderatorId: number,
  ) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException(
        `Post with id ${postId} not found`,
      );
    }

    if (post.status !== 'pending') {
      throw new BadRequestException(
        `Post with id ${postId} is not pending review`,
      );
    }

    const newStatus =
      reviewContentDto.action === 'approve'
        ? 'visible'
        : 'removed';

    const updatedPost = await this.prisma.post.update({
      where: { id: postId },
      data: {
        status: newStatus,
      },
    });

    await this.prisma.moderationLog.create({
      data: {
        reportId: null,
        targetType: 'post',
        targetId: postId,
        action: reviewContentDto.action,
        reason: reviewContentDto.note,
        moderatorId,
      },
    });

    return updatedPost;
  }

  async reviewPendingComment(
    commentId: number,
    reviewContentDto: ReviewContentDto,
    moderatorId: number,
  ) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException(
        `Comment with id ${commentId} not found`,
      );
    }

    if (comment.status !== 'pending') {
      throw new BadRequestException(
        `Comment with id ${commentId} is not pending review`,
      );
    }

    const newStatus =
      reviewContentDto.action === 'approve'
        ? 'visible'
        : 'removed';

    const updatedComment = await this.prisma.comment.update({
      where: { id: commentId },
      data: {
        status: newStatus,
      },
    });

    await this.prisma.moderationLog.create({
      data: {
        reportId: null,
        targetType: 'comment',
        targetId: commentId,
        action: reviewContentDto.action,
        reason: reviewContentDto.note,
        moderatorId,
      },
    });

    return updatedComment;
  }
}