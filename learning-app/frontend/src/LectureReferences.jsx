import React from 'react';
import { labs } from '../../../data/lab-mapping/labs.json';
import { graph as labGraph, checkpoint_views } from '../../../data/lab-mapping/knowledge-graph.json';

// Lab topic IDs and Lecture concept IDs belong to separate catalogs.
import lectureForTopic from '../../../data/lab-mapping/lecture-topics.json';
export { lectureForTopic };

const graphNodeById = new Map((labGraph?.nodes ?? []).map(n => [n.id, n]));

export function buildEnrichedMindmaps(workspace) {
  const lectureByConceptId = new Map();
  for (const [, draft] of Object.entries(workspace?.mindmaps ?? {})) {
    for (const node of draft?.nodes ?? []) {
      const cid = node.source_ref?.concept_id;
      if (cid && !lectureByConceptId.has(cid)) {
        lectureByConceptId.set(cid, node);
      }
    }
  }

  const result = {};
  for (let day = 1; day <= 14; day++) {
    const lab = labs.find(item => item.day === day);
    const rawNodes = workspace?.mindmaps?.[day]?.nodes ?? [];
    const clonedNodes = rawNodes.map(n => ({ ...n }));

    let rootNode = clonedNodes.find(n => n.node_type === 'day_root');
    if (!rootNode) {
      rootNode = {
        id: `lab-root:${day}`,
        text: `Ngày ${day}: ${lab?.title ?? `Ngày ${day}`}\n—\n${lab?.overview ?? ''}`,
        x: 920,
        y: 460,
        parent_id: null,
        node_type: 'day_root',
        source_ref: {
          concept_id: `DAY_${day}`,
          day,
          pdf_pages: [],
          section_ref: lab?.title ?? `Ngày ${day}`,
          key_quote: lab?.overview_example ?? '',
        },
        code_link: null,
        verification_status: 'verified',
      };
      clonedNodes.unshift(rootNode);
    }

    // Track which checkpoints in this day reference each Lab topic ID
    const topicCheckpoints = new Map();
    for (const cp of lab?.checkpoints ?? []) {
      const view = checkpoint_views?.[cp.id];
      for (const topicId of view?.concept_ids ?? []) {
        if (!topicCheckpoints.has(topicId)) topicCheckpoints.set(topicId, []);
        topicCheckpoints.get(topicId).push({ id: cp.id, label: cp.label, title: cp.title });
      }
    }

    for (const [topicId, cpRefs] of topicCheckpoints.entries()) {
      const mappedConceptId = lectureForTopic[topicId];
      const existing = clonedNodes.find(
        n => n.node_type !== 'day_root'
          && (n.source_ref?.concept_id === topicId
            || (mappedConceptId && n.source_ref?.concept_id === mappedConceptId)),
      );

      if (existing) {
        const prevCps = existing.lab_topic?.checkpoints ?? [];
        const mergedCps = [...prevCps];
        for (const cp of cpRefs) {
          if (!mergedCps.some(item => item.id === cp.id)) mergedCps.push(cp);
        }
        const topicNode = graphNodeById.get(topicId);
        existing.lab_topic = {
          id: existing.lab_topic?.id || topicId,
          level: existing.lab_topic?.level || topicNode?.level || 'foundation',
          definition: existing.lab_topic?.definition || topicNode?.definition || '',
          checkpoints: mergedCps,
        };
        continue;
      }

      const topicNode = graphNodeById.get(topicId);
      const lectureNode = mappedConceptId ? lectureByConceptId.get(mappedConceptId) : null;
      if (!topicNode && !lectureNode) continue;

      const isAdvanced = topicNode?.level === 'advanced';
      const title = topicNode?.label || (lectureNode?.text || '').split('\n')[0].replace(/^\[[^\]]+\]\s*/, '');
      const body = topicNode?.definition || (lectureNode?.text || '').split('\n').slice(1).join(' ');

      clonedNodes.push({
        id: `lab-topic:${day}:${topicId}`,
        text: `[${isAdvanced ? 'Nâng cao' : 'Nền tảng'}] ${title}\n${body}`,
        x: 600,
        y: 360,
        parent_id: rootNode.id,
        node_type: isAdvanced ? 'pattern' : 'concept',
        source_ref: lectureNode?.source_ref
          ? { ...lectureNode.source_ref }
          : {
              concept_id: topicId,
              day,
              pdf_pages: [],
              section_ref: lab?.title ?? `Lab Ngày ${day}`,
              key_quote: '',
            },
        code_link: lectureNode?.code_link ?? null,
        verification_status: 'verified',
        lab_topic: {
          id: topicId,
          level: topicNode?.level || 'foundation',
          definition: body,
          checkpoints: cpRefs,
        },
      });
    }

    result[day] = { nodes: clonedNodes };
  }

  return result;
}

export function resolveCheckpointMindmapNodes(checkpoint, guide, enrichedMindmaps, day) {
  const topicIds = guide?.concept_ids ?? [];
  if (!topicIds.length || !enrichedMindmaps) return [];

  const dayNodes = enrichedMindmaps[day]?.nodes ?? [];
  const seen = new Set();
  const resolved = [];

  for (const topicId of topicIds) {
    const mappedId = lectureForTopic[topicId];
    let matchDay = day;
    let node = dayNodes.find(
      n => n.node_type !== 'day_root'
        && (n.lab_topic?.id === topicId
          || n.source_ref?.concept_id === topicId
          || (mappedId && n.source_ref?.concept_id === mappedId)),
    );

    if (!node && mappedId) {
      for (const [dKey, draft] of Object.entries(enrichedMindmaps)) {
        const found = (draft?.nodes ?? []).find(
          n => n.node_type !== 'day_root' && n.source_ref?.concept_id === mappedId,
        );
        if (found) {
          node = found;
          matchDay = Number(dKey);
          break;
        }
      }
    }

    if (node && !seen.has(node.id)) {
      seen.add(node.id);
      const topicNode = graphNodeById.get(topicId);
      const rawTitle = (node.text || '').split('\n')[0].replace(/^\[[^\]]+\]\s*/, '').trim();
      resolved.push({
        day: matchDay,
        node,
        topicId,
        label: topicNode?.label || rawTitle,
        isAdvanced: topicNode?.level === 'advanced' || node.node_type === 'pattern',
      });
    }
  }

  return resolved;
}

export function LectureReferences({ day, checkpoint, guide, enrichedMindmaps, onOpenMindmap }) {
  const linked = resolveCheckpointMindmapNodes(checkpoint, guide, enrichedMindmaps, day);

  return (
    <section className="lab-mindmap-card" aria-label="Sơ đồ Mindmap tri thức cho phần thực hành">
      <div className="lab-mindmap-card-head">
        <div>
          <h3>Mindmap Tri thức · {checkpoint?.label}</h3>
          <p>
            {linked.length > 0
              ? 'Chọn khái niệm liên quan hoặc mở sơ đồ Mindmap để xem đầy đủ nội dung tri thức.'
              : 'Mở sơ đồ Mindmap của ngày học để xem tổng quan các khái niệm.'}
          </p>
        </div>
        <button
          type="button"
          className="lab-mindmap-cta"
          onClick={() => onOpenMindmap(day, linked[0]?.node.id ?? null, checkpoint)}
        >
          Hiển thị Mindmap tri thức{linked.length > 0 ? ` (${linked.length})` : ''} →
        </button>
      </div>

      {linked.length > 0 && (
        <div className="lab-concept-chips">
          {linked.map(item => (
            <button
              key={item.node.id}
              type="button"
              className={`lab-concept-chip ${item.isAdvanced ? 'is-advanced' : ''}`}
              onClick={() => onOpenMindmap(item.day, item.node.id, checkpoint)}
            >
              <span className="lab-concept-dot" aria-hidden="true" />
              <span>{item.label}</span>
              <span className="lab-concept-arrow" aria-hidden="true">↗</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
