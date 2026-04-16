import CuraBeneApp from "@/components/CuraBeneApp";
import specialitaData from "@/data/specialita.json";
import ospedaliData from "@/data/ospedali.json";
import { Specialita, Ospedale } from "@/lib/types";

export default function Home() {
  const specialita = specialitaData as Specialita[];
  const ospedali = ospedaliData as Ospedale[];

  return <CuraBeneApp specialita={specialita} ospedali={ospedali} />;
}
