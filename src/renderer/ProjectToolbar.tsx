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

export default function โปรเจกต์Toolbar({
  title,
  projectPath,
  autosaveState,
  onTitleChange,
  onOpen,
  onSave
}: Props) {
  const statusText =
    autosaveState === "saving"
      ? "กำลังบันทึกอัตโนมัติ..."
      : autosaveState === "saved"
        ? "บันทึกอัตโนมัติแล้ว"
        : autosaveState === "error"
          ? "บันทึกอัตโนมัติไม่สำเร็จ"
          : "พร้อม";

  return (
    <section className="projectToolbar">
      <div className="projectIdentity">
        <label>
          โปรเจกต์
          <input
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder="โปรเจกต์ไม่มีชื่อ"
          />
        </label>
        <span title={projectPath ?? "กู้คืนจากการบันทึกอัตโนมัติเท่านั้น"}>
          {projectPath ? fileName(projectPath) : "ยังไม่ได้บันทึกเป็นไฟล์โปรเจกต์"}
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
        <button onClick={onOpen}>เปิดโปรเจกต์</button>
        <button className="primary" onClick={onSave}>
          บันทึกโปรเจกต์
        </button>
      </div>
    </section>
  );
}
