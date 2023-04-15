import { Action, ActionPanel, Detail, Form, getPreferenceValues, Icon, List, open, useNavigation } from "@raycast/api";
import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import { ALL_CATEGORIZE, ReactSetState, State } from "../types";
import { parse } from "csv-parse";
import CreatePromptAction from "./CreatePromptAction";
import { failedToast, handleCreateHelper } from "../util";
import fs from "fs";

type Data = {
    act: string;
    prompt: string;
    categorize: string;
};

function LoadView(props: { isLoading: boolean, data: Data[], state: State, setState: ReactSetState<State> }) {
    const { isLoading, data, state, setState } = props
    return (
        <List isLoading={isLoading} isShowingDetail={true}
        >
            {data.map((item, index) => {
                return (
                    <List.Item
                        actions={
                            <ActionPanel>
                                <Action icon={Icon.Plus} title="Create Directly" onAction={() => handleCreateHelper(item.act, item.prompt, "", state, setState)} />
                                <CreatePromptAction
                                    defaultTitle={item.act}
                                    defaultPrompt={item.prompt}
                                    defaultCategorize={item.categorize}
                                    state={props.state}
                                    setState={props.setState}
                                />
                            </ActionPanel>
                        }
                        key={index}
                        title={item.act}
                        subtitle={item.categorize}
                        detail={
                            <List.Item.Detail markdown={item.prompt} />
                        }
                    />
                );
            })}
        </List>
    );
}

function UrlCsvLoader(props: { csvUrl: string, state: State, setState: ReactSetState<State> }) {
    const [data, setData] = useState<Data[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const { csvUrl, state, setState } = props;

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const response = await axios.get(csvUrl);
                parse(response.data, { columns: true, skip_empty_lines: true }, (err, records) => {
                    if (err) {
                        failedToast("Url Csv Parse Failed", err.message)
                        return
                    }
                    setData(records);
                });
            } catch (err) {
                failedToast("Url Fetch Failed", `${err}`)
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    return (
        <LoadView isLoading={isLoading} data={data} state={state} setState={setState} />
    );
}

function FileCsvLoader(props: { fileNames: string[], state: State, setState: ReactSetState<State> }) {
    const [data, setData] = useState<Data[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const { fileNames, state, setState } = props;

    useEffect(() => {
        setIsLoading(true);
        fileNames.filter((file: any) => fs.existsSync(file) && fs.lstatSync(file).isFile())
            .forEach((fileName) => {
                fs.readFile(fileName, (err, data) => {
                    if (err) {
                        failedToast(`Read File Failed,fileName:${fileName}`, err.message)
                        return
                    }
                    parse(data, { columns: true, skip_empty_lines: true }, (err, records) => {
                        if (err) {
                            failedToast("File Csv Parse Failed", err.message)
                            return
                        }
                        setData((pre) => { return pre.concat(records) });
                    });

                })
            })
        setIsLoading(false);
    }, []);

    return (
        <LoadView isLoading={isLoading} data={data} state={state} setState={setState} />
    );
}

function LoadCreatePromptForm(props: { state: State, setState: ReactSetState<State> }) {
    const [loadType, setLoadType] = useState<string>()
    const LoadTypeUrlCsv = "Url Csv"
    const LoadTypeFileCsv = "File Csv"
    const { push } = useNavigation();
    return (
        <Form
            actions={
                <ActionPanel>
                    <Action.SubmitForm title="Submit" onSubmit={(values) => {
                        switch (values.loadType) {
                            case LoadTypeUrlCsv:
                                push(< UrlCsvLoader csvUrl={values.url} state={props.state} setState={props.setState} />)
                                break
                            case LoadTypeFileCsv:
                                push(< FileCsvLoader fileNames={values.files} state={props.state} setState={props.setState} />)
                                break
                            default:
                                console.log(values)
                        }
                    }} />
                </ActionPanel>
            }
        >

            <Form.Dropdown id="loadType" title="Choice Load Type" onChange={(newValue) => setLoadType(newValue)}>
                <Form.Dropdown.Item value={LoadTypeUrlCsv} title={LoadTypeUrlCsv} />
                <Form.Dropdown.Item value={LoadTypeFileCsv} title={LoadTypeFileCsv} />
            </Form.Dropdown>
            {
                loadType === LoadTypeUrlCsv && (
                    <>
                        <Form.TextField title="url" id="url" defaultValue="https://raw.githubusercontent.com/f/awesome-chatgpt-prompts/main/prompts.csv" placeholder="input url" />
                    </>
                )
            }
            {
                loadType === LoadTypeFileCsv && (
                    <>
                        <Form.FilePicker title="files" id="files" />
                    </>
                )
            }

        </Form>
    );
}

function LoadCreatePromptAction(props: { defaultTitle?: string; state: State, setState: ReactSetState<State> }) {
    return (
        <Action.Push
            icon={Icon.Download}
            title="Load Prompt"
            shortcut={{ modifiers: ["cmd"], key: "l" }}
            target={<LoadCreatePromptForm state={props.state} setState={props.setState} />}
        />
    );
}

export default LoadCreatePromptAction;
