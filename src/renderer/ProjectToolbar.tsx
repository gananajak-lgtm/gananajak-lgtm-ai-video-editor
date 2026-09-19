type Props = {
  title: string;
  projectPath: string | null;
  autosaveState: "idle" | "saving" | "saved" | "error";
  onTitleChange: (title: string) => void;
  onOpen: () => void;
  onSave: () => void;
};

function fileName(filePath: string) {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}

export default function ProjectToolbar({
  title,
  projectPath,
  autosaveState,
  onTitleChange,
  onOpen,
  onSave
}: Props) {
  const statusText =
    autosaveState === "saving"
      ? "Autosaving..."
      : autosaveState === "saved"
        ? "Autosaved"
        : autosaveState === "error"
          ? "Autosave error"
          : "Ready";

  return (
    <section className="projectToolbar">
      <div className="projectIdentity">
        <label>
          Project
          <input
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder="Untitled project"
          />
        </label>
        <span title={projectPath ?? "Autosave recovery only"}>
          {projectPath ? fileName(projectPath) : "Not saved to a project file yet"}
        </span>
      </div>

      <div className="projectToolbarActions">
        <span
          className={
            autosaveState === "error"
              ? "autosaveBadge autosaveError"
              : "autosaveBadge"
          }
        >
          {statusText}
        </span>
        <button onClick={onOpen}>Open project</button>
        <button className="primary" onClick={onSave}>
          Save project
        </button>
      </div>
    </section>
  );
}
