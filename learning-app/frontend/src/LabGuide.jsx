import React from 'react';
import { ChatBot } from './ChatBot.jsx';
import { labs } from '../../../data/lab-mapping/labs.json';
import { checkpoint_views } from '../../../data/lab-mapping/knowledge-graph.json';
import { LectureReferences } from './LectureReferences.jsx';
import './LabGuide.css';

const groupLabels = { individual: 'Cá nhân', group: 'Làm nhóm', mixed: 'Cá nhân và nhóm' };

function SourceLink({ href, children }) {
  return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
}

function References({ checkpoint, guide }) {
  const codeGuides = guide?.code_guides ?? [];
  if (codeGuides.length === 0 && checkpoint.evidence.length === 0) return null;
  return (
    <details className="lab-extra">
      <summary>Tài liệu thực hành</summary>
      {codeGuides.length > 0 ? (
        <ul>
          {codeGuides.map(({ evidence_id, source, explanation }) => (
            <li key={evidence_id}>
              <SourceLink href={source.url}>
                {source.locator?.symbols?.join(', ') || source.path}
              </SourceLink>
              <p>{explanation}</p>
            </li>
          ))}
        </ul>
      ) : (
        <ul>
          {checkpoint.evidence.map(item => <li key={item.id}><SourceLink href={item.url}>{item.path}</SourceLink></li>)}
        </ul>
      )}
    </details>
  );
}

export function LabGuide({ day, onDayChange, selection, onSelect, workspace, loadError, onRetry, onJumpToConcept, onOpenMindmap }) {
  const lab = labs.find(item => item.day === day);
  const checkpoint = lab?.checkpoints.find(item => item.id === selection) ?? lab?.checkpoints[0];
  const guide = checkpoint_views[checkpoint?.id];

  const overviewId = lab && lab.id + '-overview';
  const showOverview = selection === overviewId;
  return (
    <div className="lab-guide">
      <header className="lab-page-header">
        <div>
          <h1>{lab?.title ?? 'Bài thực hành'}</h1>
          {lab && <p>{groupLabels[lab.work_mode]} · {lab.checkpoints.length} checkpoint</p>}
        </div>
        <label>
          Ngày học
          <select value={day} onChange={event => onDayChange(Number(event.target.value))}>
            {labs.map(item => <option key={item.id} value={item.day}>Ngày {String(item.day).padStart(2, '0')}</option>)}
          </select>
        </label>
      </header>
      {checkpoint ? (
        <div className="lab-page-layout">
          <nav className="lab-checkpoint-list" aria-label="Danh sách checkpoint">
            <h2>Nội dung bài Lab</h2>
            <ul>
              <li><button type="button" aria-current={showOverview ? 'page' : undefined} onClick={() => onSelect(overviewId)}>Tổng quan bài Lab</button></li>
              {lab.checkpoints.map(item => (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-current={!showOverview && item.id === checkpoint.id ? 'step' : undefined}
                    onClick={() => onSelect(item.id)}
                  >
                    <span className="lab-checkpoint-number">{item.label}</span>
                    <span>{item.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <label className="lab-checkpoint-picker">
            Nội dung bài Lab
            <select value={showOverview ? overviewId : checkpoint.id} onChange={event => onSelect(event.target.value)}>
              <option value={overviewId}>Tổng quan bài Lab</option>
              {lab.checkpoints.map(item => <option key={item.id} value={item.id}>{item.label} · {item.title}</option>)}
            </select>
          </label>
          {showOverview ? (<section className="lab-overview" aria-labelledby="overview-title">
        <h2 id="overview-title">Tổng quan bài Lab</h2>
        <p>{lab.overview}</p>
        {lab.overview_diagram && (
          <figure className="lab-flow">
            <figcaption>{lab.overview_diagram.caption}</figcaption>
            <ol>
              {lab.overview_diagram.stages.map((stage, index) => (
                <li key={index}>
                  {stage.map(label => <span key={label}>{label}</span>)}
                </li>
              ))}
            </ol>
          </figure>
        )}
        <p className="lab-overview-example"><strong>Ví dụ minh họa</strong> {lab.overview_example}</p>
      </section>) : (<article className="lab-checkpoint-content" key={checkpoint.id}>
            <header>
              <h2>{checkpoint.label} · {checkpoint.title}</h2>
            </header>
            <dl className="lab-checkpoint-summary">
              <div><dt>Làm gì?</dt><dd>{checkpoint.requirement}</dd></div>
              {guide?.explanation && <div><dt>Để làm gì?</dt><dd>{guide.explanation}</dd></div>}
              <div><dt>Xong khi nào?</dt><dd>{checkpoint.expected_deliverable}</dd></div>
            </dl>
            {guide?.self_check && <div className="lab-self-check"><strong>Tự kiểm</strong><p>{guide.self_check}</p></div>}
            <SourceLink href={checkpoint.definition_source.url}>Xem đề gốc</SourceLink>
            <LectureReferences guide={guide} workspace={workspace} loadError={loadError} onRetry={onRetry} onOpenMindmap={onOpenMindmap} />
            <References checkpoint={checkpoint} guide={guide} />
          </article>)}
        </div>
      ) : <p>Ngày này chưa có checkpoint.</p>}
      {lab && <ChatBot key={showOverview ? lab.id : checkpoint.id} day={day}
        labId={showOverview ? lab.id : checkpoint.id}
        focus={{ day, label: showOverview ? lab.title : checkpoint.label + ' · ' + checkpoint.title }}
        onJumpToConcept={onJumpToConcept} />}
    </div>
  );
}
