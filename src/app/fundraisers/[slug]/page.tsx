import Link from "@/components/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, MapPin, Leaf } from "lucide-react";
import { campaignById, community, organizerById } from "@/lib/content";
import { viewer } from "@/lib/store";
import {
  Avatar,
  FollowButton,
  FundraiserSidebar,
  ProgressHistory,
  Shell,
  Updates,
} from "@/components/experience";
export default async function FundraiserPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const c = campaignById((await params).slug);
  if (!c) notFound();
  const o = organizerById(c.organizerId)!;
  return (
    <Shell initial={await viewer()}>
      <main id="main" className="container fundraiser-page">
        <Link className="back-link" href={"/communities/" + community.id}>
          <ArrowLeft size={16} /> A greener tomorrow
        </Link>
        <div className="fundraiser-title">
          <p className="eyebrow">
            <Leaf size={15} /> {c.topic.toUpperCase()}
          </p>
          <h1>{c.title}</h1>
          <p className="location">
            <MapPin size={15} />
            {c.location}
            <span>·</span> Fictional fundraiser
          </p>
        </div>
        <div className="fundraiser-grid">
          <div className="fundraiser-main">
            <Image
              quality={60}
              className="fundraiser-photo"
              src={c.image}
              alt={c.alt}
              width={1100}
              height={700}
              priority
              sizes="(max-width:850px) 100vw, 65vw"
            />
            <p className="photo-caption">
              Illustrative stock photography · Fictional demo campaign
            </p>
            <section
              id="organizer"
              tabIndex={-1}
              className="organizer-block source-section"
            >
              <Link href={"/profiles/" + o.id}>
                <Avatar id={o.id} />
                <span>
                  <strong>{o.name}</strong>
                  <small>
                    Organizer · Meet the person behind this cause{" "}
                    <ArrowUpRight size={12} />
                  </small>
                </span>
              </Link>
              <FollowButton type="organizer" id={o.id} compact />
            </section>
            <section
              id="story"
              tabIndex={-1}
              className="story-section source-section"
            >
              <p className="eyebrow">THE GOOD WE CAN DO</p>
              <h2>{c.shortTitle}</h2>
              <p className="lead">{c.need}</p>
              <p>{c.story}</p>
            </section>
            <section
              id="budget"
              tabIndex={-1}
              className="budget-section source-section"
            >
              <h3>Where your support would go</h3>
              <p>{c.budget}</p>
            </section>
            <section
              id="beneficiary"
              tabIndex={-1}
              className="beneficiary-section source-section"
            >
              <span className="eyebrow">BENEFICIARY</span>
              <p>{c.beneficiary}</p>
              <small className="muted">
                The intended recipient, separate from the organizer and
                community.
              </small>
            </section>
            <ProgressHistory campaign={c} />
            <Updates campaign={c} />
            <Link
              className="community-link"
              href={"/communities/" + community.id}
            >
              <span className="sparkle-box">
                <Leaf size={26} />
              </span>
              <span>
                <small>PART OF THE COMMUNITY</small>
                <strong>A greener tomorrow</strong>
              </span>
              <ArrowUpRight size={24} />
            </Link>
          </div>
          <FundraiserSidebar campaign={c} />
        </div>
      </main>
    </Shell>
  );
}
