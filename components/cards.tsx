import Image from "next/image";
import Link from "next/link";
import { Award, CalendarDays, MapPin, UserRound } from "lucide-react";
import { getCompetitionCategory, type Competition, type Person } from "@/lib/data";

export function RoleTags({ roles }: { roles: string[] }) {
  return (
    <span className="tag-row">
      {roles.map((role) => (
        <span className="tag" key={role}>
          {role}
        </span>
      ))}
    </span>
  );
}

export function PersonCard({ person }: { person: Person }) {
  return (
    <Link className="person-card" href={`/people/${person.slug}`}>
      <Image src={person.avatar} alt={`${person.name}头像`} width={84} height={84} />
      <div>
        <div className="card-kicker">
          <UserRound size={15} />
          {person.city}
        </div>
        <h3>{person.name}</h3>
        <RoleTags roles={person.roles} />
        <p>{person.mainEvent || person.bio}</p>
      </div>
    </Link>
  );
}

export function CompetitionCard({ competition }: { competition: Competition }) {
  const category = getCompetitionCategory(competition.category);

  return (
    <Link className="event-card" href={`/competitions/${competition.slug}`}>
      <Image src={competition.cover} alt={`${competition.name}封面`} width={560} height={320} />
      <div className="event-card-body">
        <div className="card-kicker">
          <CalendarDays size={15} />
          {competition.date}
          {category ? ` · ${category.shortName}` : ""}
        </div>
        <h3>{competition.name}</h3>
        <p>{competition.summary}</p>
        <div className="meta-line">
          <MapPin size={15} />
          {competition.city} · {competition.venue}
        </div>
        <div className="tag-row">
          {competition.tags.map((tag) => (
            <span className="tag" key={tag}>
              {tag}
            </span>
          ))}
          <span className={`status status-${competition.completeness}`}>{competition.status}</span>
        </div>
      </div>
    </Link>
  );
}

export function AchievementBadge({
  title,
  type,
  description
}: {
  title: string;
  type: string;
  description: string;
}) {
  return (
    <div className="achievement-badge">
      <Award size={20} />
      <div>
        <strong>{type}</strong>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}
