export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { cpf, dataNascimento } = req.body;
  const API_KEY = process.env.NFEIO_API_KEY;

  if (!cpf) return res.status(400).json({ error: "CPF required" });

  try {
    const response = await fetch(`https:naturalperson.api.nfe.io/v1/naturalperson/status/${cpf}/${dataNascimento}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: API_KEY,
      },
    });

    const result = await response.json();

    if (!response.ok) {
      return res.status(400).json({ error: result.message || "Invalid CPF" });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("NFE Error:", error);
    return res.status(500).json({ error: "Service unavailable" });
  }
}
