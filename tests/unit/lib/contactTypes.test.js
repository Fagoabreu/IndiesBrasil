import { detectContactType, getContactLabel, getContactType, normalizeContactValue, serializeContact } from "@/lib/contactTypes";

/**
 * Testes unitários do registro de tipos de contato.
 *
 * Dois blocos de asserção carregam o peso da mudança:
 *
 *  1. **compatibilidade** — uma URL absoluta que o registro não conhece passa
 *     intacta e continua clicável. É o que garante que nenhum contato já
 *     cadastrado quebra, e o que torna a migração de dados opcional.
 *  2. **telefone** — WhatsApp e Fone são os únicos tipos com formato
 *     obrigatório; o resto do registro é permissivo de propósito.
 */

/** Monta uma linha como o banco devolve. */
function row(iconKey, contactValue) {
  return { id: 1, contact_type_id: 7, icon_key: iconKey, icon_img: "x", contact_value: contactValue };
}

describe("lib/contactTypes.js", () => {
  describe("normalizeContactValue()", () => {
    test("aceita @usuario e monta a URL do perfil", () => {
      expect(normalizeContactValue("youtube", "@greentale")).toEqual({
        ok: true,
        value: "https://www.youtube.com/@greentale",
      });
      expect(normalizeContactValue("Instagram", "@green.tale")).toEqual({
        ok: true,
        value: "https://www.instagram.com/green.tale/",
      });
    });

    test("preserva a URL quando ela já é completa", () => {
      const url = "https://www.youtube.com/channel/UCabc123";
      expect(normalizeContactValue("youtube", `  ${url}  `)).toEqual({ ok: true, value: url });
    });

    test("site sem esquema ganha https", () => {
      expect(normalizeContactValue("website", "greentale.com")).toEqual({
        ok: true,
        value: "https://greentale.com",
      });
    });

    test("e-mail: remove o mailto: e aceita o endereço puro", () => {
      expect(normalizeContactValue("email", "contato@x.com")).toEqual({ ok: true, value: "contato@x.com" });
      expect(normalizeContactValue("email", "mailto:contato@x.com")).toEqual({ ok: true, value: "contato@x.com" });
    });

    test("itch.io aceita só o subdomínio", () => {
      expect(normalizeContactValue("Itch.io", "greentale")).toEqual({
        ok: true,
        value: "https://greentale.itch.io/",
      });
    });

    test("telefone: celular e fixo viram E.164 com o esquema do tipo", () => {
      expect(normalizeContactValue("whatsapp", "(11) 99999-9999")).toEqual({
        ok: true,
        value: "https://wa.me/5511999999999",
      });
      expect(normalizeContactValue("Fone", "(21) 3333-4444")).toEqual({
        ok: true,
        value: "tel:+552133334444",
      });
    });

    test("telefone: RECUSA número inválido em vez de gravar", () => {
      const dddInvalido = normalizeContactValue("whatsapp", "(20) 99999-9999");
      expect(dddInvalido.ok).toBe(false);
      expect(dddInvalido.reason).toMatch(/telefone válido/i);

      expect(normalizeContactValue("fone", "1199999999").ok).toBe(false); // celular com 8 dígitos
      expect(normalizeContactValue("whatsapp", "não é telefone").ok).toBe(false);
    });

    test("telefone: preserva link wa.me já pronto", () => {
      const link = "https://wa.me/5511988887777";
      expect(normalizeContactValue("whatsapp", link)).toEqual({ ok: true, value: link });
    });

    test("recusa valor vazio", () => {
      expect(normalizeContactValue("youtube", "   ").ok).toBe(false);
      expect(normalizeContactValue("youtube", null).ok).toBe(false);
    });

    test("recusa valor maior que a coluna (VARCHAR 255)", () => {
      const longo = "https://x.com/" + "a".repeat(260);
      const result = normalizeContactValue("website", longo);
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/255/);
    });

    test("tipo desconhecido: guarda como está, só apara espaços", () => {
      expect(normalizeContactValue("TipoNovoDoAdmin", "  qualquer coisa  ")).toEqual({
        ok: true,
        value: "qualquer coisa",
      });
    });

    test("discord: só o convite vira link; nome solto NÃO vira convite falso", () => {
      expect(normalizeContactValue("discord", "discord.gg/Xx3udFREzc")).toEqual({
        ok: true,
        value: "https://discord.gg/Xx3udFREzc",
      });
      // Um nome solto não pode virar `discord.gg/meuuser`, que seria um destino
      // inventado.
      expect(normalizeContactValue("discord", "meuuser")).toEqual({ ok: true, value: "meuuser" });
    });
  });

  describe("serializeContact() — o que a tela mostra", () => {
    test("YouTube: handle no lugar da URL", () => {
      const contato = serializeContact(row("Youtube", "https://www.youtube.com/@GreentaleStudios"));
      expect(contato.display).toBe("@GreentaleStudios");
      expect(contato.url).toBe("https://www.youtube.com/@GreentaleStudios");
      expect(contato.label).toBe("YouTube");
    });

    test("Instagram, TikTok e Twitch viram @handle", () => {
      expect(serializeContact(row("Instagram", "https://www.instagram.com/greentalestudios/")).display).toBe("@greentalestudios");
      expect(serializeContact(row("TikTok", "https://www.tiktok.com/@x3ud")).display).toBe("@x3ud");
      expect(serializeContact(row("Twitch", "https://twitch.tv/greentale")).display).toBe("@greentale");
    });

    test("Steam: caso real do print do Green Tale", () => {
      // Era o contato que aparecia como
      // "https://store.steampowered.co m/search/?developer=Green%2 0Tale%20Studios"
      // quebrado no meio da palavra.
      const busca = serializeContact(row("Steam", "https://store.steampowered.com/search/?developer=Green%20Tale%20Studios"));
      expect(busca.display).toBe("Jogos na Steam");
      expect(busca.url).toBe("https://store.steampowered.com/search/?developer=Green%20Tale%20Studios");

      const dev = serializeContact(row("Steam", "https://store.steampowered.com/developer/Green%20Tale%20Studios"));
      expect(dev.display).toBe("Jogos de Green Tale Studios");

      const perfil = serializeContact(row("Steam", "https://steamcommunity.com/id/greentale"));
      expect(perfil.display).toBe("greentale");
    });

    test("itch.io mostra o subdomínio (outro contato do print)", () => {
      expect(serializeContact(row("Itch.io", "https://greentale.itch.io/")).display).toBe("greentale.itch.io");
    });

    test("telefone mostra o número formatado, e o href é o link", () => {
      const zap = serializeContact(row("WhatsApp", "https://wa.me/5511999999999"));
      expect(zap.display).toBe("(11) 99999-9999");
      expect(zap.url).toBe("https://wa.me/5511999999999");

      const fone = serializeContact(row("Fone", "tel:+552133334444"));
      expect(fone.display).toBe("(21) 3333-4444");
      expect(fone.url).toBe("tel:+552133334444");
    });

    test("e-mail e site: display é o próprio valor útil", () => {
      expect(serializeContact(row("Email", "contato@greentale.com")).display).toBe("contato@greentale.com");
      expect(serializeContact(row("Website", "https://www.greentalestudios.com/")).display).toBe("greentalestudios.com");
    });

    test("YouTube: vídeo avulso não promete ser canal", () => {
      expect(serializeContact(row("Youtube", "https://youtu.be/dQw4w9WgXcQ")).display).toBe("Vídeo");
    });

    test("CONTRATO: URL desconhecida passa intacta e continua clicável", () => {
      // Nenhum contato antigo pode quebrar por causa do registro.
      const url = "https://plataforma-nova.example.com/perfil/abc?x=1";
      const contato = serializeContact(row("PlataformaNova", url));
      expect(contato.url).toBe(url);
      expect(contato.display).toBeNull();
      expect(contato.label).toBe("PlataformaNova");
    });

    test("texto que não é URL fica sem link (sem href relativo)", () => {
      // Era o bug do press kit: `href="@greentale"` virava link para dentro do
      // próprio site.
      const contato = serializeContact(row("Discord", "@greentale"));
      expect(contato.url).toBeNull();
      expect(contato.display).toBe("@greentale");
    });

    test("nunca lança, mesmo com linha vazia ou implementação defeituosa", () => {
      expect(() => serializeContact(row("Steam", "https://store.steampowered.com/developer/100%"))).not.toThrow();
      expect(() => serializeContact({})).not.toThrow();
      expect(() => serializeContact(null)).not.toThrow();
      expect(serializeContact(null).url).toBeNull();
    });
  });

  describe("getContactLabel()", () => {
    test("usa o rótulo do registro quando existe", () => {
      expect(getContactLabel("GitHub")).toBe("GitHub");
      expect(getContactLabel("Itch.io")).toBe("itch.io");
      expect(getContactLabel("fone")).toBe("Fone");
    });

    test("capitaliza o icon_key quando o tipo não está no registro", () => {
      expect(getContactLabel("tipoDoAdmin")).toBe("TipoDoAdmin");
      expect(getContactLabel("")).toBe("Contato");
    });
  });

  describe("detectContactType()", () => {
    test("reconhece pelo domínio", () => {
      expect(detectContactType("https://youtube.com/@x")).toBe("youtube");
      expect(detectContactType("https://www.instagram.com/x")).toBe("instagram");
      expect(detectContactType("https://greentale.itch.io/")).toBe("itch.io");
      expect(detectContactType("https://store.steampowered.com/app/1")).toBe("steam");
      expect(detectContactType("https://discord.gg/abc")).toBe("discord");
      expect(detectContactType("https://wa.me/5511999999999")).toBe("whatsapp");
      expect(detectContactType("contato@x.com")).toBe("email");
    });

    test("aceita URL sem esquema", () => {
      expect(detectContactType("twitch.tv/canal")).toBe("twitch");
    });

    test("domínio desconhecido vira website", () => {
      expect(detectContactType("https://novo-site.example.com/a")).toBe("website");
    });

    test("não chuta em @usuario nem em valor vazio", () => {
      // `@algo` serve a várias redes — chutar marcaria o tipo errado.
      expect(detectContactType("@greentale")).toBeNull();
      expect(detectContactType("")).toBeNull();
      expect(detectContactType(null)).toBeNull();
    });
  });

  describe("getContactType()", () => {
    test("resolve aliases e é insensível a caixa", () => {
      expect(getContactType("Youtube").label).toBe("YouTube");
      expect(getContactType("yt").label).toBe("YouTube");
      expect(getContactType("Itch").label).toBe("itch.io");
      expect(getContactType("site").label).toBe("Site");
    });

    test("tipo desconhecido cai no genérico, mantendo o link clicável", () => {
      const tipo = getContactType("QualquerCoisa");
      expect(tipo.toUrl("https://x.com/a")).toBe("https://x.com/a");
      expect(tipo.toUrl("texto solto")).toBeNull();
    });
  });
});
