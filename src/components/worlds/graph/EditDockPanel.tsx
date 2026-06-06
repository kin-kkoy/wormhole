import { useState } from 'react';
import { commands, type SharedNodeData } from '../../../lib/commands';
import type { OverviewTab } from '../../../state/store';
import { SharedNodeModal } from './SharedNodeModal';
import './EditDockPanel.css';

interface EditDockPanelProps {
  graphType: OverviewTab;
  sharedNodes: SharedNodeData[];
  onSharedNodesChanged: () => void;
  onStartLinkMode: (sharedNodeId: string) => void;
}

export function EditDockPanel({
  graphType,
  sharedNodes,
  onSharedNodesChanged,
  onStartLinkMode,
}: EditDockPanelProps) {
  const [showModal, setShowModal] = useState(false);

  async function handleCreateNode(values: {
    name: string;
    fontStyle: string;
    fontSize: number;
    color: string;
  }) {
    try {
      const node = await commands.createSharedNode({
        graphType,
        name: values.name,
        fontStyle: values.fontStyle,
        fontSize: values.fontSize,
        color: values.color,
      });
      setShowModal(false);
      onSharedNodesChanged();
      // Enter link mode for the new node
      onStartLinkMode(node.id);
    } catch (e) {
      console.error('Failed to create shared node:', e);
    }
  }

  async function handleToggleHidden(node: SharedNodeData) {
    try {
      await commands.updateSharedNode({ id: node.id, hidden: !node.hidden });
      onSharedNodesChanged();
    } catch (e) {
      console.error('Failed to toggle shared node:', e);
    }
  }

  async function handleDelete(nodeId: string) {
    try {
      await commands.deleteSharedNode(nodeId);
      onSharedNodesChanged();
    } catch (e) {
      console.error('Failed to delete shared node:', e);
    }
  }

  return (
    <div className="edit-dock">
      <div className="edit-dock__header">
        <h3 className="edit-dock__title">Edit Mode</h3>
      </div>

      <div className="edit-dock__section">
        <button
          className="btn btn--primary edit-dock__create-btn"
          onClick={() => setShowModal(true)}
        >
          + Shared Node
        </button>
      </div>

      {sharedNodes.length > 0 && (
        <div className="edit-dock__section">
          <h4 className="edit-dock__section-title">Shared Nodes</h4>
          <ul className="edit-dock__node-list">
            {sharedNodes.map((node) => (
              <li key={node.id} className="edit-dock__node-item">
                <div className="edit-dock__node-info">
                  <span
                    className="edit-dock__node-color"
                    style={{ background: node.color ?? 'var(--text-muted)' }}
                  />
                  <span className={`edit-dock__node-name ${node.hidden ? 'edit-dock__node-name--hidden' : ''}`}>
                    {node.name}
                  </span>
                  <span className="edit-dock__node-count">({node.member_ids.length})</span>
                </div>
                <div className="edit-dock__node-actions">
                  <button
                    className="edit-dock__node-btn"
                    title="Link entities"
                    onClick={() => onStartLinkMode(node.id)}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                  <button
                    className="edit-dock__node-btn"
                    title={node.hidden ? 'Show' : 'Hide'}
                    onClick={() => handleToggleHidden(node)}
                  >
                    {node.hidden ? '👁' : '👁‍🗨'}
                  </button>
                  <button
                    className="edit-dock__node-btn edit-dock__node-btn--danger"
                    title="Delete"
                    onClick={() => handleDelete(node.id)}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M9 3L3 9M3 3L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showModal && (
        <SharedNodeModal
          onSubmit={handleCreateNode}
          onCancel={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
