import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ResolveReportDto } from './dto/resolve-report.dto';
import { ReviewContentDto } from './dto/review-content.dto';

@Injectable()
export class ManualModerationService {

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // --- 1. Retrieve content requiring manual moderation ---

  findAllReports(status?: string) {
	return this.prisma.report.findMany({
	  where: status ? { status } : undefined,
	  orderBy: {
		createdAt: 'desc',
	  },
	});
  }

  async findPendingContent() {
	
	// Promise.all() runs both independent queries concurrently and waits for both to resolve
	const [posts, comments] = await Promise.all([   // Array destructuring: creates two variables from the two results
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

	return {      // Returns both arrays grouped in a JavaScript object
	  posts,      // property shorthand
	  comments,
	};
  }

  // --- 2. Apply manual moderation decisions ---

  async resolveReport(                          // manual moderation action
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

	  if (!post) {
		throw new NotFoundException(
		  `Post with id ${report.targetId} not found`,
		);
	  }

	  if (resolveReportDto.action === 'remove') {     // Soft moderation instead of a hard delete - the record stays in the DB
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

	  if (!comment) {
		throw new NotFoundException(
		  `Comment with id ${report.targetId} not found`,
		);
	  }

	  if (resolveReportDto.action === 'remove') {
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

  // --- 3. Retrieve manual moderation history ---

  findAllModerationLogs() {
    return this.prisma.moderationLog.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
