import {
  DEFAULT_VIDEO_PRESET,
  MIN_VIDEO_KBPS,
  VIDEO_PRESETS,
  buildFfmpegArgs,
  estimateOutputBytes,
  formatDuration,
  getVideoPreset,
  outputFileName,
  planCompression,
  scaleToFit,
  videoBitrateForTarget,
} from "@/lib/videoPresets";

/**
 * O catálogo de compressão de vídeo é a única parte testável sem baixar 32 MB
 * de WebAssembly — e é onde os erros de verdade moram: resolução ímpar (o
 * `yuv420p` recusa), upscale (gasta CPU e bytes para piorar), bitrate que
 * ignora o áudio (estoura o alvo do WhatsApp) e argumento de áudio que quebra
 * em vídeo mudo.
 */

describe("Catálogo de presets", () => {
  test("Todo preset declara limite de dimensão e alvo (ou CRF)", () => {
    for (const preset of VIDEO_PRESETS) {
      expect(preset.id).toBeTruthy();
      expect(preset.maxDimension).toBeGreaterThan(0);
      expect(preset.audioKbps).toBeGreaterThan(0);
      expect(Boolean(preset.targetBytes) || Boolean(preset.crf)).toBe(true);
    }
  });

  test("O preset padrão existe no catálogo", () => {
    expect(() => getVideoPreset(DEFAULT_VIDEO_PRESET)).not.toThrow();
  });

  test("Preset desconhecido lança em vez de cair num padrão silencioso", () => {
    expect(() => getVideoPreset("whatsapp-inventado")).toThrow(/desconhecido/);
  });
});

describe("scaleToFit", () => {
  test("Encolhe paisagem pelo lado maior", () => {
    expect(scaleToFit(1920, 1080, 480)).toEqual({ width: 480, height: 270, scale: 0.25 });
  });

  test("Encolhe retrato pelo lado maior, não pela largura", () => {
    // 1080x1920 com limite 480: o lado maior é a altura.
    expect(scaleToFit(1080, 1920, 480)).toEqual({ width: 270, height: 480, scale: 0.25 });
  });

  test("Nunca amplia", () => {
    expect(scaleToFit(640, 360, 1920)).toEqual({ width: 640, height: 360, scale: 1 });
  });

  test("Sempre devolve dimensões pares", () => {
    // 1001 de largura num limite de 1001 multiplicado por 0.5 daria ímpar.
    const result = scaleToFit(1001, 667, 501);
    expect(result.width % 2).toBe(0);
    expect(result.height % 2).toBe(0);
  });

  test("Devolve null sem dimensões válidas", () => {
    expect(scaleToFit(0, 0, 480)).toBeNull();
    expect(scaleToFit(NaN, 1080, 480)).toBeNull();
    expect(scaleToFit(1920, 1080, 0)).toBeNull();
  });
});

describe("videoBitrateForTarget", () => {
  test("Desconta o áudio do orçamento total", () => {
    // 14 MB em 60 s: total ≈ 1957 kbps; menos 64 kbps de áudio.
    const kbps = videoBitrateForTarget({ targetBytes: 14 * 1024 * 1024, durationSeconds: 60, audioKbps: 64 });
    expect(kbps).toBe(1893);
  });

  test("Respeita o piso para vídeo longo", () => {
    const kbps = videoBitrateForTarget({ targetBytes: 14 * 1024 * 1024, durationSeconds: 3600, audioKbps: 64 });
    expect(kbps).toBe(MIN_VIDEO_KBPS);
  });

  test("Sem duração não há bitrate", () => {
    expect(videoBitrateForTarget({ targetBytes: 14 * 1024 * 1024, durationSeconds: 0 })).toBeNull();
    expect(videoBitrateForTarget({ targetBytes: 14 * 1024 * 1024, durationSeconds: null })).toBeNull();
  });

  test("Nunca pede bitrate acima do arquivo original", () => {
    // 190 KB em 4 s: ~380 kbps no total. Um alvo de 14 MB pediria ~28 Mbps e
    // entregaria um arquivo MAIOR que o original — o teto tem de ser a origem.
    const kbps = videoBitrateForTarget({
      targetBytes: 14 * 1024 * 1024,
      durationSeconds: 4,
      audioKbps: 64,
      sourceBytes: 192_000,
    });

    expect(kbps).toBeLessThan(400);
    expect(kbps).toBeGreaterThan(0);
  });
});

describe("planCompression", () => {
  const preset = getVideoPreset("whatsapp-status");

  test("Vídeo curto cabe no alvo", () => {
    const plan = planCompression({ width: 1920, height: 1080, durationSeconds: 30, preset });

    expect(plan.width).toBe(480);
    expect(plan.height).toBe(270);
    expect(plan.videoKbps).toBeGreaterThan(0);
    expect(plan.estimatedBytes).toBeLessThanOrEqual(preset.targetBytes);
    expect(plan.fitsTarget).toBe(true);
    expect(plan.warning).toBeNull();
  });

  test("Vídeo longo avisa em vez de prometer o alvo", () => {
    const plan = planCompression({ width: 1920, height: 1080, durationSeconds: 7200, preset });

    expect(plan.videoKbps).toBe(MIN_VIDEO_KBPS);
    expect(plan.fitsTarget).toBe(false);
    expect(plan.warning).toMatch(/longo demais/i);
  });

  test("Sem duração: estimativa nula e aviso, sem quebrar", () => {
    const plan = planCompression({ width: 1920, height: 1080, durationSeconds: null, preset });

    expect(plan.width).toBe(480);
    expect(plan.videoKbps).toBeNull();
    expect(plan.estimatedBytes).toBeNull();
    expect(plan.warning).toBeTruthy();
  });

  test("Preset de CRF não inventa estimativa", () => {
    const plan = planCompression({
      width: 3840,
      height: 2160,
      durationSeconds: 120,
      preset: getVideoPreset("full-hd"),
    });

    expect(plan.width).toBe(1920);
    expect(plan.height).toBe(1080);
    expect(plan.videoKbps).toBeNull();
    expect(plan.estimatedBytes).toBeNull();
    expect(plan.fitsTarget).toBe(true);
  });

  test("Vídeo curto não sai maior que a origem", () => {
    const plan = planCompression({
      width: 640,
      height: 360,
      durationSeconds: 4,
      sourceBytes: 192_000,
      preset,
    });

    expect(plan.estimatedBytes).toBeLessThanOrEqual(192_000);
    expect(plan.alreadyFits).toBe(true);
    expect(plan.warning).toMatch(/já está abaixo/i);
  });
});

describe("estimateOutputBytes", () => {
  test("Soma vídeo e áudio", () => {
    expect(estimateOutputBytes({ durationSeconds: 10, videoKbps: 1000, audioKbps: 96 })).toBe(1_370_000);
  });
});

describe("buildFfmpegArgs", () => {
  const preset = getVideoPreset("whatsapp-status");
  const plan = planCompression({ width: 1920, height: 1080, durationSeconds: 30, preset });

  test("Mapeia áudio como opcional — vídeo mudo não pode falhar o encode", () => {
    const args = buildFfmpegArgs({ input: "input", output: "output.mp4", plan, preset });
    const audioIndex = args.indexOf("0:a:0?");

    expect(audioIndex).toBeGreaterThan(0);
    expect(args[audioIndex - 1]).toBe("-map");
  });

  test("Força H.264 8 bits 4:2:0, que é o que toca em qualquer celular", () => {
    const args = buildFfmpegArgs({ input: "input", output: "output.mp4", plan, preset });

    expect(args).toEqual(expect.arrayContaining(["-c:v", "libx264", "-pix_fmt", "yuv420p", "-profile:v", "main"]));
  });

  test("Aplica o bitrate calculado e limita os picos", () => {
    const args = buildFfmpegArgs({ input: "input", output: "output.mp4", plan, preset });

    expect(args).toEqual(expect.arrayContaining(["-b:v", `${plan.videoKbps}k`]));
    expect(args).toContain("-maxrate");
    expect(args).toContain("-bufsize");
  });

  test("Preset de CRF usa -crf e não -b:v", () => {
    const crfPreset = getVideoPreset("full-hd");
    const crfPlan = planCompression({ width: 1920, height: 1080, durationSeconds: 30, preset: crfPreset });
    const args = buildFfmpegArgs({ input: "input", output: "output.mp4", plan: crfPlan, preset: crfPreset });

    expect(args).toEqual(expect.arrayContaining(["-crf", "23"]));
    expect(args).not.toContain("-b:v");
  });

  test("Remove metadados, legenda embutida e deixa o arquivo pronto para streaming", () => {
    const args = buildFfmpegArgs({ input: "input", output: "output.mp4", plan, preset });

    expect(args).toEqual(expect.arrayContaining(["-map_metadata", "-1", "-movflags", "+faststart"]));
    expect(args).toContain("-sn");
  });

  test("Sem plano de escala não emite -vf com valores nulos", () => {
    const unknownPlan = planCompression({ width: null, height: null, durationSeconds: null, preset });
    const args = buildFfmpegArgs({ input: "input", output: "output.mp4", plan: unknownPlan, preset });

    expect(args).not.toContain("-vf");
  });
});

describe("outputFileName", () => {
  test("Mantém o nome, troca a extensão e marca o preset", () => {
    expect(outputFileName("Vídeo do celular.MOV", "whatsapp-status")).toBe("Vídeo-do-celular-whatsapp-status.mp4");
  });

  test("Sem nome utilizável cai em 'video'", () => {
    expect(outputFileName("###.mp4", "social")).toBe("video-social.mp4");
  });
});

describe("formatDuration", () => {
  test("Minutos e segundos", () => {
    expect(formatDuration(95)).toBe("1:35");
    expect(formatDuration(9)).toBe("0:09");
  });

  test("Horas quando passa de 60 minutos", () => {
    expect(formatDuration(3725)).toBe("1:02:05");
  });

  test("Duração inválida vira zero", () => {
    expect(formatDuration(NaN)).toBe("0:00");
    expect(formatDuration(0)).toBe("0:00");
  });
});
