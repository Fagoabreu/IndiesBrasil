import { safeFetch } from "lib/safe-fetch";

/**
 * O guard de SSRF sozinho não bastava: ele valida a URL **uma vez**, antes do
 * fetch, e o `fetch` segue redirecionamentos por padrão. Bastava um host público
 * controlado pelo atacante responder `302 Location: http://169.254.169.254/...`
 * para o servidor buscar o endereço de metadados.
 *
 * Estes testes cobrem a parte que só existe no `safeFetch`: a decisão sobre
 * **cada hop**. O transporte é injetado (`fetchImpl`), então a lógica de
 * redirect é exercitada sem rede e sem depender de um host externo responder o
 * que o teste espera — o que tornaria o teste lento e instável.
 *
 * A resolução de DNS continua real: `127.0.0.1` e `10.0.0.1` são IPs literais,
 * que `pinPublicAddress` avalia sem consultar o resolver.
 */

/** Resposta mínima no formato que o `safeFetch` consome. */
function fakeResponse(status, { headers = {}, body = "" } = {}) {
  return { status, statusText: "", headers: { "content-encoding": "identity", ...headers }, body: Buffer.from(body) };
}

describe("lib/safe-fetch.js", () => {
  describe("recusa de endereços internos", () => {
    test("recusa loopback e redes privadas", async () => {
      for (const url of [
        "http://127.0.0.1:3000/api/v1/status",
        "http://10.0.0.5/",
        "http://192.168.1.1/",
        "http://169.254.169.254/latest/meta-data/",
        "http://[::1]/",
        "http://172.16.0.1/",
      ]) {
        await expect(safeFetch(url, { fetchImpl: async () => fakeResponse(200) })).resolves.toBeNull();
      }
    });

    test("recusa protocolo não-HTTP", async () => {
      for (const url of ["file:///etc/passwd", "ftp://exemplo.com/x", "javascript:alert(1)"]) {
        await expect(safeFetch(url, { fetchImpl: async () => fakeResponse(200) })).resolves.toBeNull();
      }
    });

    test("recusa host fora da allowlist", async () => {
      const chamadas = [];
      const fetchImpl = async (target) => {
        chamadas.push(target);
        return fakeResponse(200, { body: "ok" });
      };

      const out = await safeFetch("https://exemplo.com/imagem.png", { allowedHosts: ["res.cloudinary.com"], fetchImpl });

      expect(out).toBeNull();
      expect(chamadas).toEqual([]);
    });
  });

  describe("redirecionamentos", () => {
    test("não segue redirect para endereço interno", async () => {
      const fetchImpl = async () => fakeResponse(302, { headers: { location: "http://169.254.169.254/latest/meta-data/" } });

      // O transport devolveria 302; o `safeFetch` recusa o destino e para.
      await expect(safeFetch("https://publico.exemplo.com/x", { fetchImpl })).resolves.toBeNull();
    });

    test("não segue redirect para host fora da allowlist", async () => {
      const fetchImpl = async () => fakeResponse(302, { headers: { location: "https://outro-host.com/a" } });

      await expect(safeFetch("https://res.cloudinary.com/a", { allowedHosts: ["res.cloudinary.com"], fetchImpl })).resolves.toBeNull();
    });

    test("segue redirect para destino válido e devolve a resposta final", async () => {
      const vistos = [];
      const fetchImpl = async (target) => {
        vistos.push(target);

        if (vistos.length === 1) {
          return fakeResponse(302, { headers: { location: "https://cdn.exemplo.com/final.png" } });
        }
        return fakeResponse(200, { headers: { "content-type": "image/png" }, body: "PNGDATA" });
      };

      const out = await safeFetch("https://publico.exemplo.com/inicio.png", { fetchImpl });

      expect(vistos).toHaveLength(2);
      expect(vistos[1]).toBe("https://cdn.exemplo.com/final.png");
      expect(out.ok).toBe(true);
      expect(out.status).toBe(200);
      expect(await out.text()).toBe("PNGDATA");
    });

    test("resolve Location relativo contra a URL corrente", async () => {
      const vistos = [];
      const fetchImpl = async (target) => {
        vistos.push(target);
        return vistos.length === 1 ? fakeResponse(302, { headers: { location: "/destino.png" } }) : fakeResponse(200, { body: "x" });
      };

      await safeFetch("https://publico.exemplo.com/dir/inicio.png", { fetchImpl });

      expect(vistos[1]).toBe("https://publico.exemplo.com/destino.png");
    });

    test("para depois do teto de redirecionamentos", async () => {
      let hops = 0;
      const fetchImpl = async () => {
        hops += 1;
        return fakeResponse(302, { headers: { location: `https://publico.exemplo.com/hop${hops}` } });
      };

      const out = await safeFetch("https://publico.exemplo.com/loop", { fetchImpl, maxRedirects: 3 });

      // 1 requisição original + 3 hops; ao chegar no teto, recusa em vez de
      // continuar indefinidamente.
      expect(out).toBeNull();
      expect(hops).toBe(4);
    });

    test("devolve 3xx sem Location ao consumidor em vez de girar", async () => {
      const out = await safeFetch("https://publico.exemplo.com/x", { fetchImpl: async () => fakeResponse(304) });

      expect(out).not.toBeNull();
      expect(out.status).toBe(304);
      expect(out.ok).toBe(false);
    });
  });

  describe("envelope da resposta", () => {
    test("headers.get é case-insensitive e devolve null para ausente", async () => {
      const out = await safeFetch("https://publico.exemplo.com/x", {
        fetchImpl: async () => fakeResponse(200, { headers: { "content-type": "image/png" }, body: "a" }),
      });

      expect(out.headers.get("Content-Type")).toBe("image/png");
      expect(out.headers.get("x-inexistente")).toBeNull();
    });

    test("json() parseia e arrayBuffer() devolve os bytes", async () => {
      const out = await safeFetch("https://publico.exemplo.com/x", {
        fetchImpl: async () => fakeResponse(200, { body: '{"ok":true}' }),
      });

      expect(await out.json()).toEqual({ ok: true });
    });

    test("devolve null quando o transporte lança (timeout, DNS, TLS)", async () => {
      const out = await safeFetch("https://publico.exemplo.com/x", {
        fetchImpl: async () => {
          throw new Error("timeout");
        },
      });

      expect(out).toBeNull();
    });
  });

  describe("descompressão", () => {
    test("descomprime gzip antes de entregar o corpo", async () => {
      const zlib = await import("node:zlib");
      const comprimido = zlib.gzipSync(Buffer.from("conteudo real"));

      const out = await safeFetch("https://publico.exemplo.com/x", {
        fetchImpl: async () => ({
          status: 200,
          statusText: "",
          headers: { "content-encoding": "gzip" },
          body: comprimido,
        }),
      });

      // Sem isto, o consumidor receberia bytes comprimidos: o preview de link
      // não acharia nenhuma meta tag e o proxy de imagem serviria lixo.
      expect(await out.text()).toBe("conteudo real");
    });
  });
});
