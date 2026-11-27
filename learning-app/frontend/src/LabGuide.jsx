import React, { useLayoutEffect, useRef } from 'react';
import { labs } from '../../../data/lab-mapping/labs.json';
import { checkpoint_views } from '../../../data/lab-mapping/knowledge-graph.json';
import { LectureReferences, resolveCheckpointMindmapNodes } from './LectureReferences.jsx';
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

export function LabGuide({ day, selection, onSelect, enrichedMindmaps, onOpenMindmap }) {
  const guideRef = useRef(null);
  const lab = labs.find(item => item.day === day);
  const overviewId = lab ? `${lab.id}-overview` : 'overview';
  const activeCheckpoint = lab?.checkpoints.find(item => item.id === selection) ?? null;
  const showOverview = !activeCheckpoint;
  const guide = activeCheckpoint ? checkpoint_views[activeCheckpoint.id] : null;

  useLayoutEffect(() => {
    if (guideRef.current) guideRef.current.scrollTop = 0;
  }, [day, selection]);

  return (
    <div className="lab-guide" ref={guideRef}>
      <header className="lab-page-header">
        <div>
          <h1>Ngày {String(day).padStart(2, '0')} · {lab?.title ?? 'Bài thực hành'}</h1>
          {lab && <p>{groupLabels[lab.work_mode]} · {lab.checkpoints.length} phần thực hành</p>}
        </div>
        <button
          type="button"
          className="lab-header-mindmap-btn"
          onClick={() => onOpenMindmap(day, null, activeCheckpoint)}
        >
          Mở Mindmap Ngày {String(day).padStart(2, '0')} →
        </button>
      </header>

      {lab && lab.checkpoints.length > 0 ? (
        <div className="lab-page-layout">
          <nav className="lab-checkpoint-list" aria-label="Danh sách các phần">
            <h2>Các phần bài Lab</h2>
            <ul>
              <li>
                <button
                  type="button"
                  aria-current={showOverview ? 'page' : undefined}
                  onClick={() => onSelect(overviewId)}
                >
                  Tổng quan bài Lab
                </button>
              </li>
              {lab.checkpoints.map(item => (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-current={activeCheckpoint?.id === item.id ? 'step' : undefined}
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
            Các phần bài Lab
            <select
              value={showOverview ? overviewId : activeCheckpoint.id}
              onChange={event => onSelect(event.target.value)}
            >
              <option value={overviewId}>Tổng quan bài Lab</option>
              {lab.checkpoints.map(item => (
                <option key={item.id} value={item.id}>
                  {item.label} · {item.title}
                </option>
              ))}
            </select>
          </label>

          {showOverview ? (
            <div className="lab-overview-stack">
              <section className="lab-overview" aria-labelledby="overview-title">
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
                <p className="lab-overview-example">
                  <strong>Ví dụ minh họa</strong> {lab.overview_example}
                </p>
              </section>

              <section className="lab-parts-section" aria-labelledby="lab-parts-heading">
                <div className="lab-parts-head">
                  <h2 id="lab-parts-heading">Chọn phần thực hành để xem yêu cầu & Mindmap tri thức</h2>
                  <span>{lab.checkpoints.length} phần</span>
                </div>
                <div className="lab-parts-grid">
                  {lab.checkpoints.map(item => {
                    const itemGuide = checkpoint_views[item.id];
                    const linked = resolveCheckpointMindmapNodes(item, itemGuide, enrichedMindmaps, day);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className="lab-part-card"
                        onClick={() => onSelect(item.id)}
                      >
                        <div className="lab-part-card-top">
                          <span className="lab-part-badge">{item.label}</span>
                          {linked.length > 0 && (
                            <span className="lab-part-count">{linked.length} tri thức</span>
                          )}
                        </div>
                        <div className="lab-part-title">{item.title}</div>
                        <p className="lab-part-desc">{item.requirement}</p>
                        <span className="lab-part-cta">Chọn phần này →</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          ) : (
            <article className="lab-checkpoint-content" key={activeCheckpoint.id}>
              <header>
                <h2>{activeCheckpoint.label} · {activeCheckpoint.title}</h2>
                <SourceLink href={activeCheckpoint.definition_source.url}>Xem đề gốc</SourceLink>
              </header>
              <dl className="lab-checkpoint-summary">
                <div><dt>Làm gì?</dt><dd>{activeCheckpoint.requirement}</dd></div>
                {guide?.explanation && <div><dt>Để làm gì?</dt><dd>{guide.explanation}</dd></div>}
                <div><dt>Xong khi nào?</dt><dd>{activeCheckpoint.expected_deliverable}</dd></div>
              </dl>
              {guide?.self_check && (
                <div className="lab-self-check">
                  <strong>Tự kiểm</strong>
                  <p>{guide.self_check}</p>
                </div>
              )}
              <LectureReferences
                day={day}
                checkpoint={activeCheckpoint}
                guide={guide}
                enrichedMindmaps={enrichedMindmaps}
                onOpenMindmap={onOpenMindmap}
              />
              <References checkpoint={activeCheckpoint} guide={guide} />
            </article>
          )}
        </div>
      ) : (
        <p>Ngày này chưa có checkpoint.</p>
      )}
    </div>
  );
}
