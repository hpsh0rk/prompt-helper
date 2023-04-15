import { ActionPanel, List } from "@raycast/api";
import { LoadPromptAction } from ".";
import { Prompt, ReactSetState, State } from "../types";
import CreatePromptAction from "./CreatePromptAction";

// function EmptyView(props: { prompts: Prompt[]; searchText: string; onCreate: (title: string, prompt: string, categorize: string) => void }) {
function EmptyView(props: { prompts: Prompt[]; searchText: string; state: State, setState: ReactSetState<State> }) {
    if (props.prompts.length > 0) {
        return (
            <List.EmptyView
                icon="😕"
                title="No matching prompts found"
                description={`Can't find a prompt matching ${props.searchText}.\nCreate it now!`}
                actions={
                    <ActionPanel>
                        <CreatePromptAction defaultTitle={props.searchText} state={props.state} setState={props.setState} />
                        <LoadPromptAction state={props.state} setState={props.setState} />
                    </ActionPanel>
                }
            />
        );
    }
    return (
        <List.EmptyView
            icon="📝"
            title="No prompts found"
            description="You don't have any prompts yet. Why not add some?"
            actions={
                <ActionPanel>
                    <CreatePromptAction defaultTitle={props.searchText} state={props.state} setState={props.setState} />
                    <LoadPromptAction state={props.state} setState={props.setState} />
                </ActionPanel>
            }
        />
    );
}
export default EmptyView;
