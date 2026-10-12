import { useCallback, useEffect, useState } from 'react';
import { getModerationLogs, getPendingContent, getReports, resolveReport, reviewContent } from '../api/admin';
import { useApp } from '../context/AppContext';
import { Badge, Button, Card, EmptyState, ErrorMessage, Loading, PageHeader, SegmentedControl, inputClass } from '../components/ui';
import { formatDateTime } from '../utils/format';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const TABS = [
  { value: 'pending', label: 'Held content' },
  { value: 'reports', label: 'Reports' },
  { value: 'logs', label: 'Log' },
];

// Note field + two actions, used for both held content and reports.
function DecisionRow({ actions, onDecide }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function decide(action) {
    setBusy(true);
    try {
      await onDecide(action, note.trim());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <input
        className={`${inputClass} max-w-xs flex-1 !py-1.5 text-xs`}
        placeholder="Note (optional)"
        aria-label="Moderator note"
        maxLength={500}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {actions.map((action) => (
        <Button key={action.value} size="sm" variant={action.variant} disabled={busy} onClick={() => decide(action.value)}>
          {action.label}
        </Button>
      ))}
    </div>
  );
}

function HeldItem({ type, item, onDone }) {
  const { notify } = useApp();

  async function handleDecide(action, note) {
    try {
      await reviewContent(type, item.id, action, note);
      notify(`${type === 'post' ? 'Post' : 'Comment'} #${item.id} ${action === 'approve' ? 'approved' : 'removed'}`, 'info');
      onDone();
    } catch (err) {
      notify(err.message, 'loss');
    }
  }

  return (
    <li className="rounded-lg border border-line p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-dim">
        <Badge tone="accent">{type}</Badge>
        <span>#{item.id} · author #{item.authorId} · {formatDateTime(item.createdAt)}</span>
        <span className="ml-auto">AI score {(item.moderationScore ?? 0).toFixed(2)}</span>
      </div>
      {item.title && <h3 className="mb-1 mt-2 text-sm font-bold text-text">{item.title}</h3>}
      <p className="m-0 mt-1 whitespace-pre-wrap break-words text-sm text-dim">{item.content}</p>
      {item.moderationReasons?.length > 0 && (
        <p className="m-0 mt-2 text-xs text-accent">Flagged for: {item.moderationReasons.join(', ')}</p>
      )}
      <DecisionRow
        actions={[
          { value: 'approve', label: 'Approve', variant: 'secondary' },
          { value: 'remove', label: 'Remove', variant: 'danger' },
        ]}
        onDecide={handleDecide}
      />
    </li>
  );
}

function PendingTab() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    getPendingContent().then(setData).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  if (!data) return <Loading />;

  const items = [
    ...data.posts.map((item) => ({ type: 'post', item })),
    ...data.comments.map((item) => ({ type: 'comment', item })),
  ];

  return (
    <Card title={`Held by automatic moderation (${items.length})`}>
      {items.length === 0 ? (
        <EmptyState>Nothing waiting for review.</EmptyState>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {items.map(({ type, item }) => (
            <HeldItem key={`${type}-${item.id}`} type={type} item={item} onDone={load} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function ReportsTab() {
  const { notify } = useApp();
  const [status, setStatus] = useState('pending');
  const [reports, setReports] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    getReports(status).then(setReports).catch((err) => setError(err.message));
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDecide(report, action, note) {
    try {
      await resolveReport(report.id, action, note);
      notify(`Report #${report.id} ${action === 'remove' ? 'resolved: content removed' : 'dismissed'}`, 'info');
      load();
    } catch (err) {
      notify(err.message, 'loss');
    }
  }

  return (
    <Card
      title="User reports"
      actions={
        <SegmentedControl
          label="Report status"
          size="sm"
          options={[
            { value: 'pending', label: 'Pending' },
            { value: 'resolved', label: 'Resolved' },
          ]}
          value={status}
          onChange={setStatus}
        />
      }
    >
      <ErrorMessage>{error}</ErrorMessage>
      {!reports ? (
        <Loading />
      ) : reports.length === 0 ? (
        <EmptyState>No {status} reports.</EmptyState>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {reports.map((report) => (
            <li key={report.id} className="rounded-lg border border-line p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-dim">
                <Badge tone="down">{report.targetType} #{report.targetId}</Badge>
                <span>Report #{report.id} · by user #{report.reporterId} · {formatDateTime(report.createdAt)}</span>
                {report.resolution && <Badge className="ml-auto">{report.resolution}</Badge>}
              </div>
              <p className="m-0 mt-2 whitespace-pre-wrap break-words text-sm text-text">{report.reason}</p>
              {report.moderatorNote && <p className="m-0 mt-1 text-xs text-dim">Note: {report.moderatorNote}</p>}
              {report.status === 'pending' && (
                <DecisionRow
                  actions={[
                    { value: 'dismiss', label: 'Dismiss', variant: 'secondary' },
                    { value: 'remove', label: 'Remove content', variant: 'danger' },
                  ]}
                  onDecide={(action, note) => handleDecide(report, action, note)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function LogsTab() {
  const [logs, setLogs] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getModerationLogs().then(setLogs).catch((err) => setError(err.message));
  }, []);

  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  if (!logs) return <Loading />;

  return (
    <Card title="Moderation log">
      {logs.length === 0 ? (
        <EmptyState>No moderation actions yet.</EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <caption className="sr-only">Moderation actions</caption>
            <thead>
              <tr className="border-b border-line text-[10px] uppercase tracking-wider text-dim">
                <th scope="col" className="py-2 pr-3 font-normal">When</th>
                <th scope="col" className="py-2 pr-3 font-normal">Target</th>
                <th scope="col" className="py-2 pr-3 font-normal">Action</th>
                <th scope="col" className="py-2 pr-3 font-normal">Moderator</th>
                <th scope="col" className="py-2 font-normal">Note</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-line last:border-0">
                  <td className="py-2 pr-3 text-dim">{formatDateTime(log.createdAt)}</td>
                  <td className="py-2 pr-3 text-text">{log.targetType} #{log.targetId}</td>
                  <td className="py-2 pr-3 text-text">{log.action}</td>
                  <td className="py-2 pr-3 text-dim">{log.moderatorId ? `#${log.moderatorId}` : 'deleted account'}</td>
                  <td className="py-2 text-dim">{log.reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// Moderators and admins review what the automatic moderation held back
// and what users reported.
export default function ModerationPage() {
  useDocumentTitle('Moderation');
  const [tab, setTab] = useState('pending');

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <PageHeader
        title="Moderation"
        subtitle="Forum content held by the automatic moderation and reports from players"
        actions={<SegmentedControl label="Moderation section" options={TABS} value={tab} onChange={setTab} />}
      />
      {tab === 'pending' && <PendingTab />}
      {tab === 'reports' && <ReportsTab />}
      {tab === 'logs' && <LogsTab />}
    </div>
  );
}
