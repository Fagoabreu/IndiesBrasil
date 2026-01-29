import { Link } from "@primer/react";

export default function AdminPage() {
  return (
    <section>
      <ul>
        <li>
          <Link href="/admin/contact-types">Contact Types</Link>
        </li>
        <li>
          <Link href="/admin/tools">Tools</Link>
        </li>
      </ul>
    </section>
  );
}
