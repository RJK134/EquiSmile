import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

type WorkflowNode = {
  name: string;
  parameters: {
    authentication?: string;
    genericAuthType?: string;
    conditions?: {
      boolean?: Array<{
        value1?: string;
      }>;
    };
    bodyParameters?: {
      parameters?: Array<{
        name?: string;
        value?: string;
      }>;
    };
    values?: {
      string?: Array<{
        name?: string;
        value?: string;
      }>;
    };
  };
};

type WorkflowDefinition = {
  nodes: WorkflowNode[];
};

const workflow = JSON.parse(
  readFileSync(resolve(process.cwd(), 'n8n/03-triage-enrichment.json'), 'utf-8')
) as WorkflowDefinition;

function getNode(name: string): WorkflowNode {
  const node = workflow.nodes.find((item) => item.name === name);
  if (!node) {
    throw new Error(`Workflow node not found: ${name}`);
  }

  return node;
}

describe('03 - Triage & Enrichment workflow', () => {
  it('uses top-level classify response fields', () => {
    const checkMissingInformation = getNode('Check Missing Information');
    const sendFollowUp = getNode('Send Follow-Up');
    const readyForPlanning = getNode('Ready for Planning');

    expect(checkMissingInformation.parameters.conditions?.boolean?.[0]?.value1).toBe(
      '={{ $json.needsMoreInfo }}'
    );
    expect(sendFollowUp.parameters.bodyParameters?.parameters?.[0]?.value).toBe(
      '={{ $json.visitRequestId }}'
    );
    expect(readyForPlanning.parameters.values?.string).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'visitRequestId',
          value: '={{ $json.visitRequestId }}',
        }),
        expect.objectContaining({
          name: 'planningStatus',
          value: '={{ $json.planningStatus }}',
        }),
      ])
    );
  });

  it('uses header authentication for n8n API calls', () => {
    const classifyUrgency = getNode('Classify Urgency');
    const sendFollowUp = getNode('Send Follow-Up');

    expect(classifyUrgency.parameters.authentication).toBe('genericCredentialType');
    expect(classifyUrgency.parameters.genericAuthType).toBe('httpHeaderAuth');
    expect(sendFollowUp.parameters.authentication).toBe('genericCredentialType');
    expect(sendFollowUp.parameters.genericAuthType).toBe('httpHeaderAuth');
  });
});
