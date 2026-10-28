import { renderToStaticMarkup } from "react-dom/server";
import MeetingCard from "@/components/Meetings/MeetingCard";

/**
 * Destaque da reunião vinda do link da notificação.
 *
 * O aviso "Reunião agendada" abre `/estudios/<slug>/reunioes?meeting=<id>`; a
 * página passa `highlighted` para o card correspondente e rola até ele. Se o
 * `id` do card e a classe de destaque divergirem do que o cliente procura, o
 * link da notificação parece quebrado — a pessoa chega na lista e não sabe
 * qual das reuniões era a nova.
 */

const meeting = {
  id: "153602c7-035c-47f1-836e-f075f3847d4d",
  title: "Reunião de alinhamento",
  description: null,
  starts_at: "2026-11-01T18:00:00.000Z",
  ends_at: "2026-11-01T19:00:00.000Z",
  max_participants: null,
  created_by_username: "dona",
  status: "scheduled",
};

const viewer = { isOwner: true, isMember: true, isAdmin: true, isFollowing: false };
const authUser = { id: "u1", username: "dona" };

function render(props = {}) {
  return renderToStaticMarkup(
    <MeetingCard meeting={meeting} viewer={viewer} authUser={authUser} slug="estudio-aviso" onChanged={() => {}} {...props} />,
  );
}

function articleClass(html) {
  const match = html.match(/<article[^>]*class="([^"]*)"/);
  return match ? match[1].trim() : "";
}

describe("components/Meetings/MeetingCard", () => {
  test("O card tem o id que a página procura pelo `?meeting=`", () => {
    expect(render()).toContain(`id="meeting-${meeting.id}"`);
  });

  test("Sem `highlighted` o card tem a classe base sozinha", () => {
    const classes = articleClass(render()).split(/\s+/);
    expect(classes).toHaveLength(1);
  });

  test("`highlighted` acrescenta a classe de destaque, sem tirar a base", () => {
    const plain = articleClass(render());
    const highlighted = articleClass(render({ highlighted: true }));

    expect(highlighted).not.toBe(plain);
    expect(highlighted.startsWith(plain)).toBe(true);
    expect(highlighted.split(/\s+/).length).toBe(2);
  });

  test("O destaque não esconde o conteúdo — título e horário continuam no card", () => {
    const html = render({ highlighted: true });

    expect(html).toContain("Reunião de alinhamento");
    expect(html).toContain("meeting-");
  });
});
