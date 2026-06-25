import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RuDashboardContent } from '@/components/RuDashboardContent';

const RU_IDS = ['RU2', 'RU3', 'RU4', 'RU5', 'RU6', 'RU7'];

type Props = {
  params: Promise<{ ruId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ruId } = await params;
  const ru = ruId.toUpperCase();
  return {
    title: `${ru} Dashboard - Gas Leak Detector`,
  };
}

export default async function RuDashboardPage({ params }: Props) {
  const { ruId } = await params;
  const ru = ruId.toUpperCase();

  if (!RU_IDS.includes(ru)) {
    notFound();
  }

  return <RuDashboardContent ruId={ru} />;
}
