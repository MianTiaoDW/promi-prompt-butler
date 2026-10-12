import { ArrowUpRight, Eye } from "../components/PromiIcons";

export function WorkflowConnector(props: {
  title: string;
  sourceLabel: string;
  onView: () => void;
}) {
  return (
    <aside className="workflow-connector">
      <ArrowUpRight className="h-4 w-4" />
      <span>来自</span>
      <strong>「{props.title}」</strong>
      <small>{props.sourceLabel}</small>
      <button type="button" onClick={props.onView}><Eye className="h-3.5 w-3.5" />查看 Prompt</button>
    </aside>
  );
}
