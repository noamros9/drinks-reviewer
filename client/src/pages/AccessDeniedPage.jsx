export default function AccessDeniedPage() {
  return (
    <div className="access-denied">
      <div className="page-header">
        <h1>Access denied</h1>
      </div>
      <p className="empty-state">
        That Google account isn't authorized for this site.
        <br />
        <a href="/auth/google" className="btn-outline">Try a different account</a>
      </p>
    </div>
  );
}
