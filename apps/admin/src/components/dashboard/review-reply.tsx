"use client";

import { useState } from "react";
import type { SaveState } from "@/app/app/[tenant]/pricing/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { REPLY_MAX } from "@leadgen/core/reviews/rules";
import { Field, SaveForm, type Action } from "./form-kit";
import { DisconnectButton } from "./settings/connection-bits";

// The business's public reply to one Google review: write, change or delete.
export function ReviewReply({
  reply,
  canReply,
  saveAction,
  deleteAction,
}: {
  reply: string | null;
  canReply: boolean;
  saveAction: Action;
  deleteAction: () => Promise<SaveState>;
}) {
  const [editing, setEditing] = useState(false);

  if (reply && !editing) {
    return (
      <div className="grid gap-2 rounded-lg bg-muted/50 p-3 text-sm">
        <p className="text-xs font-medium text-muted-foreground">Your reply</p>
        <p className="whitespace-pre-wrap">{reply}</p>
        {canReply && (
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
              Change
            </Button>
            <DeleteReply action={deleteAction} />
          </div>
        )}
      </div>
    );
  }
  if (!canReply) return null;
  if (!editing) {
    return (
      <div>
        <Button type="button" size="sm" onClick={() => setEditing(true)}>
          Reply
        </Button>
      </div>
    );
  }
  return (
    <SaveForm
      action={saveAction}
      submitLabel={reply ? "Update reply" : "Post reply"}
      savedText="Posted on Google."
      onSaved={() => setEditing(false)}
      extra={
        <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      }
    >
      {(errors) => (
        <Field label="Your reply" name="reply" error={errors.reply} hint="Shown on Google under the review, as your business.">
          <Textarea name="reply" rows={4} maxLength={REPLY_MAX} defaultValue={reply ?? ""} required autoFocus />
        </Field>
      )}
    </SaveForm>
  );
}

function DeleteReply({ action }: { action: () => Promise<SaveState> }) {
  return (
    <DisconnectButton
      title="Delete your reply?"
      description="It comes off Google straight away. You can write a new one."
      done="Reply deleted"
      action={action}
    />
  );
}
