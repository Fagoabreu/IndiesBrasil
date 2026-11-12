import orchestrator from "tests/orchestrator";
import webserver from "infra/webserver";

/**
 * O compressor de vídeo é a primeira ferramenta do site que depende de um
 * arquivo estático grande fora do bundle: o core do ffmpeg.wasm, copiado de
 * `node_modules` para `public/ffmpeg` por `scripts/sync-ffmpeg-core.js`.
 *
 * Se o script não rodar, a página continua respondendo **200** — e a ferramenta
 * só quebra no clique de "Comprimir", no navegador de quem está usando. Por
 * isso o teste confere o arquivo pela HTTP, e não no filesystem: o que importa é
 * que o Next esteja servindo.
 */

const origin = webserver.origin;

describe("Ferramentas que dependem de arquivo estático", () => {
  beforeAll(async () => {
    await orchestrator.waitForAllServices();
  });

  test("A página do compressor de vídeo responde 200", async () => {
    const response = await fetch(`${origin}/ferramentas/comprimir-video`);

    expect(response.status).toBe(200);

    const html = await response.text();
    expect(html).toContain("Comprimir Vídeo");
    expect(html).toContain("WhatsApp");
  });

  test("O core do ffmpeg.wasm é servido e fica em cache imutável", async () => {
    const response = await fetch(`${origin}/ffmpeg/ffmpeg-core.wasm`, { method: "HEAD" });

    expect(response.status).toBe(200);
    // São ~30 MB: sem cache, cada visita baixaria tudo de novo — justamente o
    // público que a ferramenta atende (dados móveis limitados).
    expect(response.headers.get("cache-control")).toContain("immutable");
  });

  test("O carregador do core também é servido", async () => {
    const response = await fetch(`${origin}/ffmpeg/ffmpeg-core.js`);

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("createFFmpegCore");
  });
});
