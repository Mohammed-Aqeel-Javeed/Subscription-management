export interface ComplianceTrendsChartProps {
    data: {
        date: string;
        submitted: number;
        total: number;
    }[];
}
export default function ComplianceTrendsChart({ data }: ComplianceTrendsChartProps): import("react/jsx-runtime").JSX.Element;
