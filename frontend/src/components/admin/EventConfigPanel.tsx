"use client";

import { useState, useEffect } from "react";
import { adminUpdateEvent } from "@/lib/api";
import { AdminEvent } from "@/types";

export function EventConfigPanel({
  eventId,
  event,
  mutateEvent,
  isModal = false,
}: {
  eventId: string;
  event: AdminEvent;
  mutateEvent: () => void;
  isModal?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description || "");
  const [timezone, setTimezone] = useState(event.timezone);
  const [statusVal, setStatusVal] = useState(event.status);
  const [scoreboardPublic, setScoreboardPublic] = useState(event.scoreboard_public);
  const [rootUrlOnly, setRootUrlOnly] = useState(event.root_url_detection_enabled);
  const [sharedFolder, setSharedFolder] = useState(event.shared_folder_enabled);
  const [awsButton, setAwsButton] = useState(event.show_aws_console_button);
  const [sshButton, setSshButton] = useState(event.show_ssh_key_button);

  useEffect(() => {
    setTitle(event.title);
    setDescription(event.description || "");
    setTimezone(event.timezone);
    setStatusVal(event.status);
    setScoreboardPublic(event.scoreboard_public);
    setRootUrlOnly(event.root_url_detection_enabled);
    setSharedFolder(event.shared_folder_enabled);
    setAwsButton(event.show_aws_console_button);
    setSshButton(event.show_ssh_key_button);
  }, [event]);

  async function handleSave() {
    if (!title.trim()) {
      setError("Event title is required");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      await adminUpdateEvent(eventId, {
        title: title.trim(),
        description: description.trim() || null,
        timezone,
        status: statusVal,
        scoreboard_public: scoreboardPublic,
        root_url_detection_enabled: rootUrlOnly,
        shared_folder_enabled: sharedFolder,
        show_aws_console_button: awsButton,
        show_ssh_key_button: sshButton,
      });
      setSuccess(true);
      setIsEditing(false);
      mutateEvent();
      setTimeout(() => setSuccess(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update event");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setIsEditing(false);
    setTitle(event.title);
    setDescription(event.description || "");
    setTimezone(event.timezone);
    setStatusVal(event.status);
    setScoreboardPublic(event.scoreboard_public);
    setRootUrlOnly(event.root_url_detection_enabled);
    setSharedFolder(event.shared_folder_enabled);
    setAwsButton(event.show_aws_console_button);
    setSshButton(event.show_ssh_key_button);
    setError(null);
  }

  return (
    <div className={`bg-[#ffffff] ${!isModal ? 'border border-[#d1d5db] rounded-lg' : ''} overflow-hidden`}>
      {!isModal && (
        <div className="px-5 py-3 border-b border-[#d1d5db] flex items-center justify-between">
          <span className="text-xs font-semibold text-[#0f172a] uppercase tracking-wider">Event Configuration</span>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="text-xs px-4 py-1.5 border border-[#d1d5db] hover:border-[#4ade80] text-[#475569] hover:text-[#4ade80] rounded transition-colors"
            >
              Edit Settings
            </button>
          )}
        </div>
      )}

      {isEditing ? (
        <div className={`${isModal ? 'p-5' : 'p-5'} space-y-4`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[#64748b] mb-1">Event Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border border-[#d1d5db] rounded px-3 py-2 text-sm text-[#0f172a]"
                placeholder="Event title"
              />
            </div>
            <div>
              <label className="block text-xs text-[#64748b] mb-1">Timezone</label>
              <input
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full border border-[#d1d5db] rounded px-3 py-2 text-sm text-[#0f172a]"
                placeholder="UTC"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-[#64748b] mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-[#d1d5db] rounded px-3 py-2 text-sm text-[#0f172a] resize-none"
              rows={3}
              placeholder="Event description"
            />
          </div>

          <div>
            <label className="block text-xs text-[#64748b] mb-2">Status</label>
            <select
              value={statusVal}
              onChange={(e) => setStatusVal(e.target.value as any)}
              className="w-full border border-[#d1d5db] rounded px-3 py-2 text-sm text-[#0f172a]"
            >
              <option value="draft">Draft</option>
              <option value="live">Live</option>
              <option value="paused">Paused</option>
              <option value="ended">Ended</option>
            </select>
          </div>

          <div className="space-y-3 border-t border-[#e2e8f0] pt-4">
            <h4 className="text-xs font-semibold text-[#0f172a] uppercase tracking-wider">Feature Toggles</h4>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={scoreboardPublic}
                onChange={(e) => setScoreboardPublic(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm text-[#475569]">Scoreboard Public</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={rootUrlOnly}
                onChange={(e) => setRootUrlOnly(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm text-[#475569]">Root URL Detection Only</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={sharedFolder}
                onChange={(e) => setSharedFolder(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm text-[#475569]">Shared Folder Enabled</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={awsButton}
                onChange={(e) => setAwsButton(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm text-[#475569]">Show AWS Console Button</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={sshButton}
                onChange={(e) => setSshButton(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm text-[#475569]">Show SSH Key Button</span>
            </label>
          </div>

          {error && <p className="text-[#f87171] text-xs">{error}</p>}

          <div className="flex gap-2 justify-end border-t border-[#e2e8f0] pt-4">
            <button
              onClick={handleCancel}
              disabled={saving}
              className="px-4 py-2 border border-[#d1d5db] rounded text-sm text-[#475569] hover:bg-[#f8fafc] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !title.trim()}
              className="px-4 py-2 bg-[#4ade80] hover:bg-[#22c55e] text-black rounded text-sm font-semibold disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      ) : (
        <div className={`${isModal ? 'p-5' : 'p-5'} space-y-3 text-sm`}>
          {isModal && !isEditing && (
            <div className="mb-4 flex justify-end">
              <button
                onClick={() => setIsEditing(true)}
                className="text-xs px-4 py-1.5 border border-[#d1d5db] hover:border-[#4ade80] text-[#475569] hover:text-[#4ade80] rounded transition-colors"
              >
                Edit Settings
              </button>
            </div>
          )}
          <div>
            <span className="text-[#64748b] text-xs">Title</span>
            <div className="text-[#0f172a] font-semibold mt-0.5">{event.title}</div>
          </div>
          {event.description && (
            <div>
              <span className="text-[#64748b] text-xs">Description</span>
              <div className="text-[#475569] mt-0.5">{event.description}</div>
            </div>
          )}
          <div>
            <span className="text-[#64748b] text-xs">Timezone</span>
            <div className="text-[#0f172a] mt-0.5">{event.timezone}</div>
          </div>
          <div>
            <span className="text-[#64748b] text-xs">Features</span>
            <div className="text-[#475569] text-xs mt-1 space-y-1">
              {event.scoreboard_public && <div>✓ Scoreboard Public</div>}
              {event.root_url_detection_enabled && <div>✓ Root URL Detection</div>}
              {event.shared_folder_enabled && <div>✓ Shared Folder</div>}
              {event.show_aws_console_button && <div>✓ AWS Console Button</div>}
              {event.show_ssh_key_button && <div>✓ SSH Key Button</div>}
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className={`${isModal ? 'mx-5 mb-5 rounded border border-[#86efac] px-4' : 'px-5 py-3 border-t border-[#86efac]'} py-3 bg-[#f0fdf4] text-[#16a34a] text-xs font-semibold`}>
          ✓ Event settings updated successfully
        </div>
      )}
    </div>
  );
}
