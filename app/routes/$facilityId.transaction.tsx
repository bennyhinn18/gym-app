import { json, type LoaderFunction } from "@remix-run/node";
import {
  useLoaderData,
  useSearchParams,
  useSubmit,
  Form,
  Link,
  useParams,
} from "@remix-run/react";
import { Bell, Phone, Settings, Search, Filter } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { supabase } from "~/utils/supabase.server";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "~/components/ui/chart";
import { Line, LineChart, XAxis, YAxis } from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useState, useEffect } from "react";

interface Transaction {
  id: number;
  user: string;
  amount: number;
  timestamp: string;
  avatar: string;
  plan: string;
}

interface DailyEarning {
  date: string;
  amount: number;
}

interface Plan {
  id: string;
  name: string;
}

export const loader: LoaderFunction = async ({ params, request }) => {
  const facilityId = params.facilityId;
  const url = new URL(request.url);
  const timelineFilter = url.searchParams.get("timeline") || "today";
  const planFilter = url.searchParams.get("plan") || "all";
  const searchTerm = url.searchParams.get("search") || "";

  let startDate, endDate;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  switch (timelineFilter) {
    case "today":
      startDate = today;
      endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000);
      break;
    case "yesterday":
      startDate = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      endDate = today;
      break;
    case "thisMonth":
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      break;
    case "lastMonth":
      startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      endDate = new Date(today.getFullYear(), today.getMonth(), 0);
      break;
    case "last7Days":
      startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      endDate = today;
      break;
    case "last30Days":
      startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      endDate = today;
      break;
    default:
      startDate = today;
      endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  }

  let query = supabase
    .from("transactions")
    .select(
      `
      id,
      amount,
      created_at,
      members (id, full_name, email),
      memberships (plans (id, name))
    `
    )
    .eq("type", "payment")
    .eq("facility_id", facilityId)
    .gte("created_at", startDate.toISOString())
    .lt("created_at", endDate.toISOString())
    .order("created_at", { ascending: false });

  if (planFilter !== "all") {
    query = query.eq("memberships.plans.id", planFilter);
  }

  if (searchTerm) {
    query = query.or(
      `members.full_name.ilike.%${searchTerm}%,members.email.ilike.%${searchTerm}%`
    );
  }

  const { data: transactions, error: transactionError } = await query;

  if (transactionError) {
    console.error("Error fetching transactions:", transactionError);
    throw new Response("Error fetching transactions", { status: 500 });
  }

  // Calculate income
  const income = transactions.reduce((sum, t) => sum + t.amount, 0);

  // Fetch previous period's income
  const previousStartDate = new Date(
    startDate.getTime() - (endDate.getTime() - startDate.getTime())
  );
  const { data: previousTransactions, error: previousError } = await supabase
    .from("transactions")
    .select("amount")
    .eq("type", "payment")
    .eq("facility_id", facilityId)
    .gte("created_at", previousStartDate.toISOString())
    .lt("created_at", startDate.toISOString());

  if (previousError) {
    console.error("Error fetching previous transactions:", previousError);
    throw new Response("Error fetching previous transactions", { status: 500 });
  }

  const previousIncome = previousTransactions.reduce(
    (sum, t) => sum + t.amount,
    0
  );

  // Calculate daily earnings
  const dailyEarnings: DailyEarning[] = [];
  for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
    const dateString = d.toISOString().split("T")[0];
    const amount = transactions
      .filter((t) => t.created_at.startsWith(dateString))
      .reduce((sum, t) => sum + t.amount, 0);
    dailyEarnings.push({ date: dateString, amount });
  }

  // Fetch total pending balance from members table
  const { data: membersBalance, error: membersBalanceError } = await supabase
    .from("members")
    .select("balance")
    .eq("facility_id", facilityId)
    .gt("balance", 0);

  if (membersBalanceError) {
    console.error("Error fetching members balance:", membersBalanceError);
    throw new Response("Error fetching members balance", { status: 500 });
  }

  const totalPendingBalance = membersBalance.reduce(
    (sum, member) => sum + member.balance,
    0
  );

  // Fetch plans
  const { data: plans, error: plansError } = await supabase
    .from("plans")
    .select("id, name")
    .eq("facility_id", facilityId);

  if (plansError) {
    console.error("Error fetching plans:", plansError);
    throw new Response("Error fetching plans", { status: 500 });
  }

  return json({
    transactions: transactions.map((t) => ({
      id: t.id,
      user: t.members.full_name,
      amount: t.amount,
      timestamp: new Date(t.created_at).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
      }),
      avatar: `https://api.dicebear.com/6.x/initials/svg?seed=${t.members.full_name}`,
      plan: t.memberships?.plans?.name || "N/A",
    })),
    income,
    previousIncome,
    totalPendingBalance,
    dailyEarnings,
    plans,
    timelineFilter,
    planFilter,
    searchTerm,
  });
};

export default function Transactions() {
  const {
    transactions,
    income,
    previousIncome,
    totalPendingBalance,
    dailyEarnings,
    plans,
    timelineFilter,
    planFilter,
    searchTerm: initialSearchTerm,
  } = useLoaderData<{
    transactions: Transaction[];
    income: number;
    previousIncome: number;
    totalPendingBalance: number;
    dailyEarnings: DailyEarning[];
    plans: Plan[];
    timelineFilter: string;
    planFilter: string;
    searchTerm: string;
  }>();

  const [searchParams, setSearchParams] = useSearchParams();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const submit = useSubmit();
  const params = useParams();

  useEffect(() => {
    setSearchTerm(initialSearchTerm);
  }, [initialSearchTerm]);

  // Calculate total amount and percentages
  const totalAmount = income + totalPendingBalance;
  const receivedPercentage = (income / totalAmount) * 100;
  const pendingPercentage = (totalPendingBalance / totalAmount) * 100;

  // Calculate stroke-dasharray and stroke-dashoffset for each segment
  const circumference = 2 * Math.PI * 45;
  const receivedDash = (receivedPercentage / 100) * circumference;
  const pendingDash = (pendingPercentage / 100) * circumference;

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    searchParams.set("search", searchTerm);
    setSearchParams(searchParams);
  };

  const handleFilterChange = (key: string, value: string) => {
    searchParams.set(key, value);
    setSearchParams(searchParams);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header */}
      <header className="bg-white p-4 flex items-center justify-between">
        <div className="flex items-center">
          <h1 className="text-xl font-bold ml-6">Transaction</h1>
        </div>
        <div className="flex items-center space-x-4">
          {/* <Bell className="h-6 w-6 text-purple-500" /> */}
          <a href="tel:7010976271">
            <Phone className="h-6 w-6 text-purple-500" />
          </a>
          <Settings className="h-6 w-6 text-purple-500" />
        </div>
      </header>

      {/* Search and Filter */}
      <div className="p-4">
        <form onSubmit={handleSearch} className="relative flex items-center">
          <Input
            type="text"
            placeholder="Search by name or email"
            className="pl-10 pr-20 py-2 w-full bg-white rounded-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <div className="absolute right-3 flex space-x-2">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-purple-500"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
            >
              <Filter className="text-purple-500" />
            </Button>
          </div>
        </form>
      </div>

      {/* Filter options */}
      {isFilterOpen && (
        <div className="p-4 bg-white space-y-4">
          <div>
            <label
              htmlFor="timeline"
              className="block text-sm font-medium text-gray-700"
            >
              Timeline
            </label>
            <Select
              name="timeline"
              defaultValue={timelineFilter}
              onValueChange={(value) => handleFilterChange("timeline", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select timeline" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="thisMonth">This Month</SelectItem>
                <SelectItem value="lastMonth">Last Month</SelectItem>
                <SelectItem value="last7Days">Last 7 Days</SelectItem>
                <SelectItem value="last30Days">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label
              htmlFor="plan"
              className="block text-sm font-medium text-gray-700"
            >
              Plan
            </label>
            <Select
              name="plan"
              defaultValue={planFilter}
              onValueChange={(value) => handleFilterChange("plan", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plans</SelectItem>
                {plans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="p-4 space-y-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Transactions Chart */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Transactions</CardTitle>
                <Badge variant="secondary">{timelineFilter}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative w-48 h-48 mx-auto">
                <svg
                  viewBox="0 0 100 100"
                  className="transform -rotate-90 w-full h-full"
                >
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth="10"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="10"
                    strokeDasharray={`${receivedDash} ${circumference}`}
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="10"
                    strokeDasharray={`${pendingDash} ${circumference}`}
                    strokeDashoffset={-receivedDash}
                  />
                </svg>
              </div>
              <div className="space-y-2 mt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-3 h-3 rounded-full bg-blue-500 mr-2" />
                    <span>Total received</span>
                  </div>
                  <span>₹{income.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-3 h-3 rounded-full bg-red-500 mr-2" />
                    <span>Total Pending</span>
                  </div>
                  <span>₹{totalPendingBalance.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Income Stats */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Income</CardTitle>
                <Badge variant="secondary">{timelineFilter}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center">
                    <h3 className="text-4xl font-bold">₹{income.toFixed(2)}</h3>
                    <Badge
                      variant="secondary"
                      className="ml-2 bg-green-100 text-green-600"
                    >
                      ↑{" "}
                      {(
                        ((income - previousIncome) / previousIncome) *
                        100
                      ).toFixed(1)}
                      %
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-500">
                    Compared to ₹{previousIncome.toFixed(2)} in previous period
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Total Pending Balance</p>
                  <p className="text-2xl font-bold text-red-500">
                    ₹{totalPendingBalance.toFixed(2)}
                  </p>
                </div>
                <div className="pt-4">
                  <h4 className="text-sm font-medium mb-2">Earning Summary</h4>
                  <ChartContainer
                    config={{
                      amount: {
                        label: "Amount",
                        color: "hsl(216, 20%, 80%)",
                      },
                    }}
                    className="h-[300px] w-full"
                  >
                    <LineChart data={dailyEarnings}>
                      <XAxis
                        dataKey="date"
                        tickFormatter={(value) =>
                          new Date(value).toLocaleDateString("en-US", {
                            weekday: "short",
                          })
                        }
                      />
                      <YAxis
                        tickFormatter={(value) => `₹${value / 1000}k`}
                        domain={[0, "auto"]}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line
                        type="monotone"
                        dataKey="amount"
                        stroke="var(--color-amount)"
                        strokeWidth={2}
                        dot={{ r: 4, fill: "var(--color-amount)" }}
                      />
                    </LineChart>
                  </ChartContainer>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transactions List */}
        <Card className="bg-purple-50">
          <CardContent className="p-4">
            {transactions.map((transaction: Transaction) => (
              <Link
                key={transaction.id}
                to={`/${params.facilityId}/members/${transaction.id}`}
                className="flex items-center justify-between bg-white p-4 rounded-lg mb-2 last:mb-0 hover:bg-gray-50 transition-colors duration-150 ease-in-out"
              >
                <div className="flex items-center space-x-3">
                  <Avatar>
                    <AvatarImage
                      src={transaction.avatar}
                      alt={transaction.user}
                    />
                    <AvatarFallback>{transaction.user[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{transaction.user}</p>
                    <p className="text-sm text-gray-500">
                      {transaction.timestamp}
                    </p>
                    <p className="text-xs text-gray-400">{transaction.plan}</p>
                  </div>
                </div>
                <span className="text-green-500 font-medium">
                  +{transaction.amount.toFixed(2)}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
