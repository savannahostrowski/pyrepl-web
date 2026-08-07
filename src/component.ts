import { html, LitElement, type PropertyValues } from "lit";
import { customElement } from "lit/decorators.js";
import { PyReplEmbed } from "./embed.js";

@customElement("py-repl")
export class PyRepl extends LitElement {
  private repl: PyReplEmbed | null = null;

  static override properties = {
    theme: { type: String },
    packages: { type: String },
    replTitle: { type: String, attribute: "repl-title" },
    noBanner: { type: Boolean, attribute: "no-banner" },
    isReadonly: { type: Boolean, attribute: "readonly" },
    noButtons: { type: Boolean, attribute: "no-buttons" },
    noHeader: { type: Boolean, attribute: "no-header" },
    src: { type: String },
  };

  declare theme: string;
  declare packages: string;
  declare replTitle: string;
  declare noBanner: boolean;
  declare isReadonly: boolean;
  declare noButtons: boolean;
  declare noHeader: boolean;
  declare src: string;

  constructor() {
    super();
    this.theme = "catppuccin-mocha";
    this.packages = "";
    this.replTitle = "Python REPL";
    this.noBanner = false;
    this.isReadonly = false;
    this.noButtons = false;
    this.noHeader = false;
    this.src = "";
  }

  // Disable shadow DOM to allow external CSS styling
  protected override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  protected override firstUpdated(_changedProperties: PropertyValues): void {
    super.firstUpdated(_changedProperties);
    this.initializeRepl();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated && !this.repl) {
      this.initializeRepl();
    }
  }

  private initializeRepl(): void {
    const container = this.querySelector(".pyrepl") as HTMLElement | null;
    if (!container) {
      console.error("pyrepl-web: .pyrepl container not found in <py-repl>");
      return;
    }
    container.replaceChildren();
    // Mark as initialized to prevent setup() from picking it up
    container.dataset.pyreplInitialized = "true";
    const repl = new PyReplEmbed({
      container,
      theme: this.theme,
      packages: this.packages
        .split(",")
        .map((pkg) => pkg.trim())
        .filter((pkg) => pkg.length > 0),
      readonly: this.isReadonly,
      src: this.src || undefined,
      showHeader: !this.noHeader,
      showButtons: !this.noButtons,
      title: this.replTitle,
      showBanner: !this.noBanner,
    });
    this.repl = repl;
    void repl.init().catch((error) => {
      if (this.repl === repl) {
        console.error("pyrepl-web: failed to initialize", error);
      }
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.repl?.destroy();
    this.repl = null;
  }

  override render() {
    return html`<div class="pyrepl"></div>`;
  }
}
