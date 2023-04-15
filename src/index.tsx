import { useCallback, useEffect, useState } from "react";
import { nanoid } from "nanoid";
import { Action, ActionPanel, confirmAlert, Form, Icon, List, LocalStorage, popToRoot, PopToRootType, showHUD, showToast, Toast } from "@raycast/api";
import { ALL_CATEGORIZE, getAllCategorize, getPromptVar, Prompt, State } from "./types";
import { CreatePromptAction, DeletePromptAction, EmptyView, EditPromptAction, PastePromptAction, LoadPromptAction, } from "./components";
import { failedToast, successToast } from "./util";
import { finished } from "stream";

export default function Command() {
    const [state, setState] = useState<State>({
        categorize: ALL_CATEGORIZE,
        isLoading: true,
        searchText: "",
        prompts: [],
        visiblePrompts: [],
    });

    useEffect(() => {
        (async () => {
            const storedPrompts = await LocalStorage.getItem<string>("prompts");

            if (!storedPrompts) {
                setState((previous) => ({ ...previous, isLoading: false }));
                return;
            }

            try {
                const prompts: Prompt[] = JSON.parse(storedPrompts);
                setState((previous) => ({ ...previous, prompts, isLoading: false }));
            } catch (e) {
                // can't decode prompts
                setState((previous) => ({ ...previous, prompts: [], isLoading: false }));
            }
        })();
    }, []);

    useEffect(() => {
        (async () => {
            const categorize = await LocalStorage.getItem<string>("categorize");

            if (!categorize) {
                setState((previous) => ({ ...previous, isLoading: false }));
                return;
            }

            setState((previous) => ({ ...previous, categorize, isLoading: false }));
        })();
    }, []);

    useEffect(() => {
        const result = JSON.stringify(state.prompts)
        LocalStorage.setItem("prompts", result);
    }, [state.prompts]);

    useEffect(() => {
        LocalStorage.setItem("categorize", state.categorize);
    }, [state.categorize]);

    const handleEdit = useCallback(
        (id: string, title: string, context: string, categorize: string) => {
            const newPrompts = [...state.prompts];
            newPrompts.forEach((p) => {
                if (p.id == id) {
                    p.title = title;
                    p.context = context;
                    p.categorize = categorize;
                }
            })
            setState((previous) => ({ ...previous, prompts: newPrompts }));
            successToast("Edit Prompt", title)
        },
        [state.prompts, setState]
    );

    const handleDelete = useCallback(
        (index: number) => {
            const deletedPrompt = state.prompts[index]
            const newPrompts = [...state.prompts];
            newPrompts.splice(index, 1);
            setState((previous) => ({ ...previous, prompts: newPrompts }));
            successToast("Delete Prompt", deletedPrompt.title)
        },
        [state.prompts, setState]
    );

    const filterPrompts = useCallback(() => {
        if (state.categorize == ALL_CATEGORIZE) {
            return state.prompts;
        }
        return state.prompts.filter((prompt) => prompt.categorize === state.categorize);
    }, [state.prompts, state.categorize]);

    return (
        <List
            isLoading={state.isLoading}
            searchText={state.searchText}
            searchBarAccessory={
                <List.Dropdown
                    tooltip="Select Prompt List"
                    value={state.categorize}
                    onChange={(newValue) => setState((previous) => ({ ...previous, categorize: newValue }))}
                >
                    <>
                        <List.Dropdown.Item title="All" value={ALL_CATEGORIZE} />
                        {
                            Array.from(getAllCategorize(state.prompts)).map((v) => {
                                return <List.Dropdown.Item key={v} title={v} value={v} />
                            })
                        }
                    </>
                </List.Dropdown>
            }
            filtering={true}
            onSearchTextChange={(newValue) => {
                setState((previous) => ({ ...previous, searchText: newValue }));
            }}
            isShowingDetail={true}
        >
            <EmptyView prompts={filterPrompts()} searchText={state.searchText} state={state} setState={setState} />
            {
                filterPrompts().map((prompt, index) => (
                    <List.Item
                        key={prompt.id}
                        icon={getPromptVar(prompt.context).size > 0 ? Icon.Window : Icon.Text}
                        title={prompt.title}
                        actions={
                            <ActionPanel>
                                <PastePromptAction prompt={prompt} />
                                <ActionPanel.Section>
                                    <CreatePromptAction state={state} setState={setState} />
                                    <DeletePromptAction onDelete={() => handleDelete(index)} />
                                    <EditPromptAction prompt={prompt} onEdit={handleEdit} />
                                    <LoadPromptAction state={state} setState={setState} />
                                    <Action.Push
                                        icon="📚"
                                        title="Json Config"
                                        target={
                                            <Form
                                                actions={
                                                    <ActionPanel>
                                                        <Action.SubmitForm title="Update Config"
                                                            onSubmit={(values) => {
                                                                try {
                                                                    const prompts: Prompt[] = JSON.parse(values.prompts);
                                                                    setState((previous) => ({ ...previous, prompts, isLoading: false }));
                                                                    successToast("Update Config Success", "")
                                                                } catch (e) {
                                                                    // can't decode prompts
                                                                    setState((previous) => ({ ...previous, prompts: [], isLoading: false }));
                                                                    failedToast("Update Config Failed", `${e}`)
                                                                } finally {
                                                                    popToRoot()
                                                                }
                                                            }}
                                                        />
                                                    </ActionPanel>
                                                }
                                            >
                                                <Form.TextArea id="prompts" defaultValue={JSON.stringify(state.prompts)} />
                                            </Form>
                                        } />
                                </ActionPanel.Section>
                            </ActionPanel>
                        }
                        detail={
                            <List.Item.Detail markdown={prompt.context} />
                        }
                    />
                ))
            }
        </List >
    );
}
