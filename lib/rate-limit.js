// Rate limiter em memória — protege contra brute-force e abuso de recursos.
// Cada limiter tem seu próprio Map e janela, com expiração automática.
//
// Premissa: instância única. Em escala horizontal cada processo teria seu
// próprio contador e o limite efetivo seria multiplicado pelo número de
// réplicas. Ao escalar, trocar a implementação por Redis mantendo a mesma
// interface (`check` retornando `{ allowed, remaining, resetMs }`).

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // limpa entradas expiradas a cada 5 min

/** Cria um limiter isolado com janela e teto próprios.
 * @param {{ name: string, max: number, windowMs: number }} options
 */
function createLimiter({ name, max, windowMs }) {
  const attempts = new Map();

  /**
   * Consome uma tentativa para a chave informada.
   * @param {string} key — tipicamente o IP do cliente.
   * @returns {{ allowed: boolean, remaining: number, resetMs: number }}
   */
  function check(key) {
    const now = Date.now();
    const entry = attempts.get(key);

    if (!entry || now - entry.firstAttempt > windowMs) {
      attempts.set(key, { count: 1, firstAttempt: now });
      return { allowed: true, remaining: max - 1, resetMs: windowMs };
    }

    entry.count += 1;

    if (entry.count > max) {
      const resetMs = windowMs - (now - entry.firstAttempt);
      return { allowed: false, remaining: 0, resetMs: Math.max(resetMs, 0) };
    }

    return { allowed: true, remaining: max - entry.count, resetMs: windowMs - (now - entry.firstAttempt) };
  }

  function reset() {
    attempts.clear();
  }

  function cleanup() {
    const now = Date.now();
    for (const [key, entry] of attempts) {
      if (now - entry.firstAttempt > windowMs) {
        attempts.delete(key);
      }
    }
  }

  return { name, check, reset, cleanup, max, windowMs };
}

const limiters = {
  // Login: 5 tentativas / 15 min (comportamento original preservado).
  login: createLimiter({ name: "login", max: 5, windowMs: 15 * 60 * 1000 }),
  // Criação de conta: limita flood de contas e email bombing para terceiros.
  register: createLimiter({ name: "register", max: 5, windowMs: 60 * 60 * 1000 }),
  // Reset de senha: limita flood de e-mails.
  reset: createLimiter({ name: "reset", max: 5, windowMs: 60 * 60 * 1000 }),
  // Escrita em conteúdo (depoimentos, denúncias): limita spam autenticado.
  write: createLimiter({ name: "write", max: 30, windowMs: 10 * 60 * 1000 }),
  // Mensagens diretas: duas janelas, porque o abuso tem duas formas — rajada
  // numa mesma conversa e volume ao longo do dia (assédio em massa pela lista
  // de membros). A chave é o `id` do usuário, não o IP: a conta é que abusa.
  messages: createLimiter({ name: "messages", max: 30, windowMs: 60 * 1000 }),
  messagesDaily: createLimiter({ name: "messagesDaily", max: 200, windowMs: 24 * 60 * 60 * 1000 }),
  // Proxies e previews: limita amplificação e abuso de recursos.
  proxy: createLimiter({ name: "proxy", max: 120, windowMs: 60 * 1000 }),
};

// Timer único de limpeza para todos os limiters.
const cleanupTimer = setInterval(() => {
  for (const limiter of Object.values(limiters)) {
    limiter.cleanup();
  }
}, CLEANUP_INTERVAL_MS);

// Allow the timer to not prevent Node.js from exiting.
if (cleanupTimer.unref) {
  cleanupTimer.unref();
}

/**
 * Checks if the given key has exceeded the rate limit.
 * Mantido para compatibilidade — delega ao limiter de login.
 * @param {string} key — typically the client IP address.
 * @returns {{ allowed: boolean, remaining: number, resetMs: number }}
 */
function check(key) {
  return limiters.login.check(key);
}

/**
 * Returns the client IP from the request object.
 * Handles reverse proxy (nginx) via X-Forwarded-For.
 * @param {object} request — Next.js / next-connect request object.
 * @returns {string} IP address.
 */
function getClientIp(request) {
  const forwarded = clientIpFromForwarded(request.headers["x-forwarded-for"]);
  if (forwarded) return forwarded;
  return request.socket?.remoteAddress || request.connection?.remoteAddress || "unknown";
}

/** Extrai o IP real de um `X-Forwarded-For` no formato usado pelo nginx.
 *
 * O nginx faz `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for`,
 * que acrescenta `$remote_addr` ao FINAL da lista. As entradas anteriores vêm
 * do cliente e podem ser forjadas, por isso a última é a única confiável.
 */
function clientIpFromForwarded(forwarded) {
  if (!forwarded) return null;
  const parts = forwarded.split(",");
  const last = parts[parts.length - 1].trim();
  return last || null;
}

/**
 * Mesmo cálculo de `getClientIp`, para o `Headers` de uma requisição do
 * App Router (Web `Request`). Aqui não há `socket.remoteAddress`, então sem o
 * `X-Forwarded-For` o resultado é "unknown" — que `isLocalRequest` trata como
 * local. Se o projeto passar a servir tráfego público sem nginx na frente, o
 * limiter fica inoperante: é preciso resolver o IP na borda.
 */
function getClientIpFromWebRequest(request) {
  return clientIpFromForwarded(request.headers.get("x-forwarded-for")) || "unknown";
}

/** Loopback não passa por limiter: tráfego interno/teste. Em produção o nginx
 *  sempre define X-Forwarded-For com o IP real, então loopback só aparece
 *  de tráfego interno — e os testes rodam por ele. */
function isLocalRequest(clientIp) {
  return clientIp === "127.0.0.1" || clientIp === "::1" || clientIp === "::ffff:127.0.0.1" || clientIp === "unknown";
}

/**
 * Resets all rate-limit counters. Useful for tests.
 */
function reset() {
  for (const limiter of Object.values(limiters)) {
    limiter.reset();
  }
}

const rateLimit = {
  check,
  getClientIp,
  getClientIpFromWebRequest,
  isLocalRequest,
  reset,
  limiters,
  MAX_ATTEMPTS: limiters.login.max,
  WINDOW_MS: limiters.login.windowMs,
};

export default rateLimit;
