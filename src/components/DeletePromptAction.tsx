import { Action, Icon } from "@raycast/api";

function DeletePromptAction(props: { onDelete: () => void }) {
    return (
        <Action
            icon={Icon.Trash}
            title="Delete Prompt"
            shortcut={{ modifiers: ["cmd"], key: "d" }}
            onAction={props.onDelete}
        />
    );
}

export default DeletePromptAction;
