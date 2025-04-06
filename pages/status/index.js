import useSWR from "swr";

async function fetchAPI(key) {
  const response = await fetch(key);
  const responseBody = await response.json();
  return responseBody;
}

export default function StatusPage() {
  return (
    <>
      <div className="container mt-5 mb-3">
        <div className="row">
          <h1 className="heading">Server Status</h1>
        </div>
        <div className="row">
          <div className="col-md-4">
            <div className="card p-3 mb-2">
              <div className="d-flex justify-content-between">
                <div className="d-flex flex-row align-items-center">
                  <div className="icon">
                    {" "}
                    <i className="bx"></i>{" "}
                  </div>
                  <div className="ms-2 c-details">
                    <UpdatedAt />
                  </div>
                </div>
              </div>
              <div className="mt-5">
                <DatabaseStatus />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  function UpdatedAt() {
    const { isLoading, data } = useSWR("/api/v1/status", fetchAPI, {
      refreshInterval: 20000,
    });

    let updatedAtText = "Carregando...";

    if (!isLoading && data) {
      updatedAtText = new Date(data.updated_at).toLocaleString("pt-BR");
    }
    return (
      <>
        <h6 className="mb-0">Atualizado</h6> <span>{updatedAtText}</span>
      </>
    );
  }

  function DatabaseStatus() {
    const { isLoading, data } = useSWR("/api/v1/status", fetchAPI, {
      refreshInterval: 20000,
    });

    let databaseStatusInfo = "Carregando...";
    if (!isLoading && data) {
      databaseStatusInfo = (
        <>
          <div>Versão: {data.dependencies.database.version}</div>
          <div className="mt-5">
            <div className="progress">
              <div
                className="progress-bar"
                role="progressbar"
                style={{
                  width: `${(data.dependencies.database.opened_connections * 100) / data.dependencies.database.max_connections}%`,
                }}
                aria-valuenow={data.dependencies.database.opened_connections}
                aria-valuemin="0"
                aria-valuemax={data.dependencies.database.max_connections}
              ></div>
            </div>
            <div className="mt-3">
              {" "}
              <span className="text1">
                {data.dependencies.database.opened_connections} Conexões{" "}
                <span className="text2">
                  de {data.dependencies.database.max_connections}
                </span>
              </span>{" "}
            </div>
          </div>
        </>
      );
    }
    return (
      <>
        <h3>Database</h3>
        <div>{databaseStatusInfo}</div>
      </>
    );
  }
}
