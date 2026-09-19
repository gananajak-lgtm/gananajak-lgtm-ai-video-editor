type Props = {
  missingMedia: string[];
  relinking: boolean;
  onRelinkFolder: () => void;
  onRelinkSingle: (missingPath: string) => void;
};

function fileName(filePath: string) {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}

function parentPath(filePath: string) {
  const normalized = filePath.replace(/\\/g, "/");
  const index = normalized.lastIndexOf("/");
  return index > 0 ? normalized.slice(0, index) : normalized;
}

export default function MediaRelinkPanel({
  missingMedia,
  relinking,
  onRelinkFolder,
  onRelinkSingle
}: Props) {
  if (missingMedia.length === 0) return null;

  return (
    <section className="mediaRelinkPanel">
      <div className="mediaRelinkHeader">
        <div>
          <p className="eyebrow">MISSING MEDIA</p>
          <h3>
            {missingMedia.length} moved or unavailable file
            {missingMedia.length === 1 ? "" : "s"}
          </h3>
          <p className="muted">
            Point the editor at the new folder and it will reconnect files by
            exact filename. Ambiguous or unmatched files can be relinked one by
            one.
          </p>
        </div>

        <button
          className="primary"
          disabled={relinking}
          onClick={onRelinkFolder}
        >
          {relinking ? "Searching..." : "Find files in folder"}
        </button>
      </div>

      <div className="missingMediaList">
        {missingMedia.slice(0, 30).map((missingPath) => (
          <div className="missingMediaRow" key={missingPath}>
            <div>
              <strong>{fileName(missingPath)}</strong>
              <small title={missingPath}>{parentPath(missingPath)}</small>
            </div>
            <button
              disabled={relinking}
              onClick={() => onRelinkSingle(missingPath)}
            >
              Relink file
            </button>
          </div>
        ))}
      </div>

      {missingMedia.length > 30 && (
        <p className="timelineHint">
          Showing the first 30 missing files. Folder relink checks the complete
          list.
        </p>
      )}
    </section>
  );
}
