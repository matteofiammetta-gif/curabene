import CuraBeneApp from "@/components/CuraBeneApp";
import specialitaData from "@/data/specialita.json";
import ospedaliData from "@/data/ospedali.json";
import { Specialita, Ospedale, OspedaliDB } from "@/lib/types";

export default function Home() {
  const specialita = specialitaData as Specialita[];
  const db = ospedaliData as unknown as OspedaliDB;
  const ospedali = db.ospedali as Ospedale[];

  return <CuraBeneApp specialita={specialita} ospedali={ospedali} />;
}
