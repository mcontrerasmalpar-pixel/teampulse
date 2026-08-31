// @ts-check
/** Compact gold set: id, topic, ownerA, ownerB, task, decision, risk */
export const ROWS = [
  ['standup-01', 'Daily standup', 'Alice', 'Bob', 'Fix login timeout', 'Ship dark mode', 'API rate limit'],
  ['planning-02', 'Sprint planning', 'Carla', 'Diego', 'Estimate backlog', 'Lock sprint goal', 'Scope creep'],
  ['retro-03', 'Sprint retro', 'Elena', 'Farid', 'Write action items', 'Keep daily notes', 'Low test coverage'],
  ['incident-04', 'Incident review', 'Gina', 'Hugo', 'Patch auth token', 'Add pager rotation', 'Single region outage'],
  ['design-05', 'Design critique', 'Ines', 'Jules', 'Update Figma kit', 'Adopt 8pt grid', 'Inconsistent colors'],
  ['hiring-06', 'Hiring sync', 'Kara', 'Leo', 'Schedule onsite', 'Hire senior backend', 'Pipeline too thin'],
  ['budget-07', 'Budget review', 'Mara', 'Nico', 'Cut vendor spend', 'Freeze headcount', 'Runway six months'],
  ['security-08', 'Security review', 'Olga', 'Pete', 'Rotate API keys', 'Enable SSO', 'Shared admin account'],
  ['data-09', 'Data standup', 'Quinn', 'Rita', 'Backfill events', 'Use warehouse as source', 'Late pipelines'],
  ['mobile-10', 'Mobile sync', 'Sam', 'Tina', 'Fix crash on iOS', 'Drop iOS 15', 'Store review delay'],
  ['growth-11', 'Growth meeting', 'Uma', 'Vic', 'Launch referral', 'Raise signup cap', 'Paid CAC rising'],
  ['support-12', 'Support ops', 'Wendy', 'Xavi', 'Triage P1 queue', 'Hire weekend cover', 'SLA breaches'],
  ['legal-13', 'Legal review', 'Yara', 'Zack', 'Update DPA', 'Sign vendor addendum', 'Missing subprocessors'],
  ['infra-14', 'Infra weekly', 'Ana', 'Ben', 'Migrate redis', 'Keep blue-green deploys', 'No multi-az'],
  ['product-15', 'Product review', 'Cora', 'Dan', 'Ship waitlist', 'Cut chat widget', 'Unclear ICP'],
  ['qa-16', 'QA gate', 'Eve', 'Finn', 'Add flake quarantine', 'Block merge on red', 'Flaky e2e'],
  ['sales-17', 'Sales forecast', 'Gia', 'Hank', 'Refresh CRM', 'Focus mid-market', 'Long cycles'],
  ['partner-18', 'Partner call', 'Ivy', 'Jon', 'Draft integration spec', 'Pilot in Q3', 'API versioning'],
  ['content-19', 'Content planning', 'Kim', 'Liz', 'Publish changelog', 'Weekly release notes', 'No owner for docs'],
  ['ml-20', 'ML review', 'Mo', 'Ned', 'Retrain ranker', 'Ship offline eval', 'Label drift'],
  ['finance-21', 'Close books', 'Ona', 'Paz', 'Reconcile invoices', 'Close month by Friday', 'Missing receipts'],
  ['people-22', 'People ops', 'Rio', 'Sia', 'Send pulse survey', 'Keep hybrid policy', 'Manager load'],
  ['research-23', 'User research', 'Tao', 'Uri', 'Schedule five interviews', 'Drop onboarding modal', 'Small sample'],
  ['board-24', 'Board prep', 'Val', 'Wes', 'Assemble metrics pack', 'Hold extra cash', 'Churn uptick'],
];

export function buildDataset() {
  return {
    version: 1,
    cases: ROWS.map(([id, topic, ownerA, ownerB, task, decision, risk]) => ({
      id,
      format: 'txt',
      transcript: [
        `SUMMARY: ${topic} covering delivery risks and owners.`,
        `TASK: ${task} | owner=${ownerA} | priority=high`,
        `TASK: Follow up notes | owner=${ownerB} | priority=medium`,
        `RISK: ${risk}`,
        `DECISION: ${decision}`,
        '',
      ].join('\n'),
      expected: {
        summary: `${topic} covering delivery risks and owners.`,
        tasks: [
          { title: task, owner: ownerA, priority: 'high' },
          { title: 'Follow up notes', owner: ownerB, priority: 'medium' },
        ],
        risks: [{ title: risk }],
        decisions: [{ title: decision }],
      },
    })),
  };
}

export default { ROWS, buildDataset };
