import ssrfGuard, { isPrivateIp, isSafeUrl } from "@/lib/ssrf-guard";

/**
 * Guard de SSRF.
 *
 * A versão anterior olhava só o prefixo textual do IPv6 (`fc`, `fd`, `fe`, `ff`)
 * — `::ffff:127.0.0.1` não casa nenhum deles e passava como **público**. Como
 * `lib/safe-fetch.js` fixa o endereço validado na conexão e usa `isPrivateIp`
 * como única barreira, isso liberava o loopback: Postgres em `127.0.0.1:5432`,
 * o app em `:3000` e o Galene em `:8000`.
 *
 * Os casos abaixo são o contrato: um deles falhando significa caminho aberto
 * para a rede interna.
 */
describe("lib/ssrf-guard", () => {
  describe("isPrivateIp — IPv4", () => {
    test.each([
      ["127.0.0.1", "loopback"],
      ["127.1.2.3", "loopback em outro octeto"],
      ["10.0.0.1", "RFC1918"],
      ["172.16.5.4", "RFC1918"],
      ["192.168.1.1", "RFC1918"],
      ["169.254.169.254", "metadados de nuvem"],
      ["100.64.0.1", "CGNAT"],
      ["0.0.0.0", "endereço indefinido"],
      ["192.0.2.10", "TEST-NET-1"],
      ["198.18.0.1", "benchmark"],
    ])("bloqueia %s (%s)", (ip) => {
      expect(isPrivateIp(ip)).toBe(true);
    });

    test.each([["8.8.8.8"], ["1.1.1.1"], ["69.62.94.15"], ["2606:4700::1111"]])("libera %s", (ip) => {
      expect(isPrivateIp(ip)).toBe(false);
    });
  });

  describe("isPrivateIp — IPv6", () => {
    test.each([
      ["::1", "loopback"],
      ["::", "indefinido"],
      ["fc00::1", "unique-local"],
      ["fd12:3456::1", "unique-local"],
      ["fe80::1", "link-local"],
      ["ff02::1", "multicast"],
      ["2001:db8::1", "documentação"],
      ["2001:0000:4136:e378::1", "Teredo (túnel para IPv4)"],
    ])("bloqueia %s (%s)", (ip) => {
      expect(isPrivateIp(ip)).toBe(true);
    });

    test.each([["2606:4700:4700::1111"], ["2a00:1450:4001:80f::200e"]])("libera %s", (ip) => {
      expect(isPrivateIp(ip)).toBe(false);
    });
  });

  describe("isPrivateIp — IPv4 embutido em IPv6 (o bypass)", () => {
    // Cada um destes alcança o IPv4 equivalente quando o host é dual-stack. Era
    // exatamente aqui que o guard liberava o loopback.
    test.each([
      ["::ffff:127.0.0.1", "loopback mapeado em notação decimal"],
      ["::ffff:7f00:1", "loopback mapeado em notação hexadecimal"],
      ["::ffff:169.254.169.254", "metadados mapeados"],
      ["::ffff:10.0.0.1", "RFC1918 mapeado"],
      ["::ffff:192.168.0.1", "RFC1918 mapeado"],
      ["64:ff9b::127.0.0.1", "NAT64 para loopback"],
      ["64:ff9b::10.0.0.1", "NAT64 para RFC1918"],
      ["2002:7f00:0001::", "6to4 carregando 127.0.0.1"],
      ["2002:c0a8:0101::", "6to4 carregando 192.168.1.1"],
      ["::127.0.0.1", "IPv4-compatível (obsoleto)"],
    ])("bloqueia %s (%s)", (ip) => {
      expect(isPrivateIp(ip)).toBe(true);
    });

    test("libera o IPv4 embutido quando o destino é público", () => {
      expect(isPrivateIp("::ffff:8.8.8.8")).toBe(false);
      expect(isPrivateIp("2002:0808:0808::")).toBe(false);
      expect(isPrivateIp("64:ff9b::8.8.8.8")).toBe(false);
    });
  });

  describe("isPrivateIp — entrada inválida", () => {
    test("bloqueia por padrão (fail closed)", () => {
      expect(isPrivateIp("")).toBe(true);
      expect(isPrivateIp("não é ip")).toBe(true);
      expect(isPrivateIp("999.999.999.999")).toBe(true);
      expect(isPrivateIp(undefined)).toBe(true);
    });
  });

  describe("isSafeUrl", () => {
    test("recusa esquema que não é http(s)", async () => {
      expect(await isSafeUrl("file:///etc/passwd")).toBe(false);
      expect(await isSafeUrl("ftp://exemplo.com/x")).toBe(false);
      expect(await isSafeUrl("javascript:alert(1)")).toBe(false);
      expect(await isSafeUrl("não é url")).toBe(false);
    });

    test("recusa IP literal privado", async () => {
      expect(await isSafeUrl("http://127.0.0.1:5432/")).toBe(false);
      expect(await isSafeUrl("http://[::1]/")).toBe(false);
      // O caso que o guard antigo deixava passar.
      expect(await isSafeUrl("http://[::ffff:127.0.0.1]:5432/")).toBe(false);
      expect(await isSafeUrl("http://169.254.169.254/latest/meta-data/")).toBe(false);
    });

    test("allowlist de host é aplicada antes do DNS", async () => {
      expect(await isSafeUrl("https://evil.example/x", { allowedHosts: ["res.cloudinary.com"] })).toBe(false);
    });
  });

  test("o default export expõe as duas funções", () => {
    expect(ssrfGuard.isPrivateIp).toBe(isPrivateIp);
    expect(ssrfGuard.isSafeUrl).toBe(isSafeUrl);
  });
});
