import React from 'react';

// Lab topic IDs and Lecture concept IDs belong to separate catalogs.
const lectureForTopic = {
  embedding: 'CON_D1_TRANSFORMER',
  'text-classification': 'CON_D1_TAXONOMY',
  'classification-metrics': 'MET_D5_FP_FN_COST',
  'product-discovery': 'CON_D2_PROBLEM_DISCOVERY',
  'problem-validation': 'CON_D2_PROBLEM_DISCOVERY',
  'problem-framing': 'CON_D2_PROBLEM_CARD',
  'intervention-choice': 'PAT_D2_BUILD_BOOST_BUY',
  'tool-contract': 'PAT_D3_REACT_HYBRID',
  'tool-routing': 'PAT_D4_TOOL_LOOP_LANGGRAPH',
  'agent-loop': 'PAT_D3_REACT_HYBRID',
  'step-budget': 'CON_D3_SYSTEM_PROMPT_SAFEGUARDS',
  'agent-trace': 'CON_D9_ERROR_ANALYSIS_5LAYERS',
  grounding: 'PAT_D7_GEN_POSTGEN',
  'eval-cases': 'CON_D9_DATASETS_RATCHET_CI',
  'failure-taxonomy': 'CON_D9_ERROR_ANALYSIS_5LAYERS',
  'trajectory-grading': 'PAT_D9_EVAL_HARNESS_LAYERED_GRADER',
  'evaluation-baseline': 'PAT_D9_EVAL_HARNESS_LAYERED_GRADER',
  'quality-gate': 'CON_D10_STAGE_GATE_5ELEMENTS',
  'acceptance-threshold': 'CON_D10_STAGE_GATE_5ELEMENTS',
  autonomy: 'CON_D8_4LEVELS_WORKFLOWS',
  'graceful-failure': 'PAT_D5_UX_4PATHS',
  chunking: 'PAT_D7_PRE_RETRIEVAL',
  'vector-retrieval': 'PAT_D7_RETRIEVAL',
  'retrieval-context': 'PAT_D7_POST_RETRIEVAL_AUGMENT',
  durability: 'PAT_D8_DURABLE_IDEMPOTENCY',
  handoff: 'PAT_D8_MULTI_AGENT_AUTONOMY_CODE',
  guardrails: 'PAT_D11_DEFENSE_TRIFECTA_CAMEL',
  'cost-per-success': 'MET_D13_COST_OF_PASS',
  sensitivity: 'MET_D13_COST_OF_PASS',
  interrater: 'MET_D6_DAMA_KAPPA',
  'pilot-design': 'PAT_D13_CONTROLLED_PILOT',
  'launch-decision': 'MET_D2_GO_NOGO',
  containers: 'PAT_D12_DOCKER_2026',
  'api-controls': 'PAT_D12_GATEWAY_CACHE_SERVING',
  deployment: 'PAT_D12_DOCKER_2026',
};

export function LectureReferences({ guide, workspace, loadError, onRetry, onJumpToConcept }) {
  const targets = new Set((guide?.concept_ids ?? []).map(id => lectureForTopic[id]).filter(Boolean));
  const notes = Object.values(workspace?.mindmaps ?? {}).flatMap(day => day.nodes)
    .filter(node => targets.has(node.source_ref?.concept_id));
  return (
    <details className="lab-extra">
      <summary>Kiến thức từ Lecture{notes.length > 0 && ` (${notes.length})`}</summary>
      {loadError && !workspace ? <p>Chưa tải được Lecture. <button type="button" onClick={onRetry}>Thử lại</button></p>
        : !workspace ? <p>Đang tải Lecture…</p>
        : notes.length === 0 ? <p>Chưa có mục Lecture được liên kết với checkpoint này.</p>
        : <ul>{notes.map(node => {
          const [title, ...body] = node.text.split('\n');
          return <li key={node.id}>
            <strong>{title.replace(/^\[[^\]]+\]\s*/, '')}</strong>
            <p>{body.join(' ')}</p>
            <small>{node.source_ref.section_ref}</small>
            <button className="lab-node-link" type="button" onClick={() => onJumpToConcept(node.source_ref.concept_id, node.source_ref.day)}>Mở đúng nút trên Mindmap →</button>
          </li>;
        })}</ul>}
    </details>
  );
}
