import { Component } from "react";
import { RotateCcw } from "lucide-react";

export default class ModuleErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(previousProps) {
    if (previousProps.module !== this.props.module && this.state.failed) {
      this.setState({ failed: false });
    }
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="module-error" role="alert">
        <b>Modul belum bisa dibuka.</b>
        <p>Periksa koneksi lalu muat ulang halaman untuk mencoba lagi.</p>
        <button
          className="btn-primary"
          onClick={() => window.location.reload()}
        >
          Muat ulang <RotateCcw size={16} />
        </button>
      </div>
    );
  }
}
