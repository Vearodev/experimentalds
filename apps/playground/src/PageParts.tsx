export function SectionHeading({
  number,
  title,
  note,
  id,
}: {
  number: string;
  title: string;
  note?: string;
  id?: string;
}) {
  return (
    <div className="section-heading" id={id}>
      <div>
        <span className="section-number">{number}</span>
        <h2>{title}</h2>
      </div>
      {note && <span>{note}</span>}
    </div>
  );
}
export function PageHeading({
  category,
  title,
  description,
  children,
}: {
  category: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <div className="eyebrow">{category}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </header>
  );
}
