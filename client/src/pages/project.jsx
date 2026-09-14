import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProjectsList, useStationList } from "@/hook/useProject";
import { getStationList } from "@/api/station";
import { getTaqmnStationList } from "@/api/openData";
import { LayoutDashboard, ChartNoAxesCombined, Check, Plus, Trash2 } from "lucide-react";
import PageTitle from "@/components/common/PageTitle";
import BaseCard from "@/components/common/card/BaseCard";
import BaseButton from "@/components/common/button/BaseButton";
import BaseSelect from "@/components/common/select/BaseSelect";
import BaseInput from "@/components/common/input/BaseInput";
import BaseDialog from "@/components/common/dialog/BaseDialog";
import BaseTab from "@/components/common/tab/BaseTab";
import BaseTable from "@/components/common/table/BaseTable";
import GoogleMap from "@/components/common/map/GoogleMap";
import BaseApiLoaderWrapper from "@/components/common/api/ApiLoaderWrapper";
import { useStationSelections } from "@/hook/useStationSelections";
import {
  addComparisonStation,
  addDashboardStation,
  clearComparisonStations,
  clearDashboardStations,
  getComparisonStations,
  getDashboardStations,
  removeComparisonStation,
  removeDashboardStation,
} from "@/utils/stationSelectionStorage";

export default function Project() {
  const navigate = useNavigate();
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isStationDialogOpen, setIsStationDialogOpen] = useState(false);
  const [stationViewMode, setStationViewMode] = useState("list");
  const [enabled, setEnabled] = useState(1);
  const [selectedStationNameMap, setSelectedStationNameMap] = useState({});
  const dashboardStations = useStationSelections(getDashboardStations);
  const comparisonStations = useStationSelections(getComparisonStations);

  const {
    data: projectsListData,
    loading: loadingProjectsList,
    error: errorProjectsList,
    fetchProjectsList,
  } = useProjectsList();

  const {
    data: StationListData,
    loading: loadingStationList,
    error: errorStationList,
    fetchStationList,
  } = useStationList();

  const handleProjectClick = (projectId) => {
    setActiveProjectId(projectId);
    setEnabled(1);
    setIsStationDialogOpen(true);
    setStationViewMode("list");
  };

  useEffect(() => { 
    fetchProjectsList(); 
  }, []);

  useEffect(() => {
    if (activeProjectId !== null) 
    fetchStationList({ project: activeProjectId, enabled });
  }, [activeProjectId, enabled]);

  useEffect(() => {
    let ignore = false;
    const projectIds = [...new Set(
      [...dashboardStations, ...comparisonStations].map((station) => station.PJID),
    )];

    if (!projectIds.length) {
      setSelectedStationNameMap({});
      return undefined;
    }

    const fetchSelectedStationNames = async () => {
      const results = await Promise.allSettled(
        projectIds.map((PJID) => (
          PJID === "TAQMN"
            ? getTaqmnStationList()
            : getStationList({ PJID, enabled: 1 })
        )),
      );

      if (ignore) return;

      const names = {};
      results.forEach((result, index) => {
        if (result.status !== "fulfilled") return;

        result.value?.forEach((station) => {
          const PJID = projectIds[index];
          const STID = station.STID;
          names[`${PJID}::${STID}`] = PJID === "TAQMN"
            ? `${station.County || ""}-${station.STName || ""}`
            : `(${STID}) ${station.IIT || ""}`.trim();
        });
      });
      setSelectedStationNameMap(names);
    };

    fetchSelectedStationNames();
    return () => { ignore = true; };
  }, [dashboardStations, comparisonStations]);

  const isStored = (station, purpose) => {

    const list = purpose === "dashboard" ? dashboardStations : comparisonStations;
    const PJID = station.PJID;
    const STID = station.STID;

    return list.some((item) => item.PJID === PJID && item.STID === STID);
  };

  const handleStationToggle = (station, purpose) => {
    const payload = {
      PJID: station.PJID,
      STID: station.STID,
    };
    const selected = isStored(station, purpose);

    if (purpose === "dashboard") {
      if (selected) {
        removeDashboardStation(payload.PJID, payload.STID);
      } else {
        addDashboardStation(payload);
      }
    } else {
      if (selected) {
        removeComparisonStation(payload.PJID, payload.STID);
      } else {
        addComparisonStation(payload);
      }
    }
  };

  const columns = [
    {
      id: "action",
      header: "操作",
      cell: ({ row }) => {
        const station = row.original;
        const inDashboard = isStored(station, "dashboard");
        const inComparison = isStored(station, "comparison");
        return (
          <div className="flex min-w-max gap-2">
            <BaseButton
              onClick={() => handleStationToggle(station, "dashboard")}
              variant={inDashboard ? "default" : "outline"}
              size="table"
            >
              {inDashboard ? <Check size={16} className="mr-2" /> : <Plus size={16} className="mr-2" />}
              {inDashboard ? "已加入儀表板" : "加入儀表板"}
            </BaseButton>
            <BaseButton
              onClick={() => handleStationToggle(station, "comparison")}
              variant={inComparison ? "default" : "outline"}
              size="table"
            >
              {inComparison ? <Check size={16} className="mr-2" /> : <Plus size={16} className="mr-2" />}
              {inComparison ? "已加入比對" : "加入比對"}
            </BaseButton>
          </div>
        );
      },
    },
    { accessorKey: "name", header: "測站" },
    { accessorKey: "desc", header: "描述" },
  ];

  const currentProjectName = projectsListData?.find((project) => project.id === activeProjectId)?.name;

  const currentProject = {
    name: currentProjectName,
    stations: StationListData || [],
  };

  const filteredProjects = (projectsListData || []).filter((project) =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const hasSelections = dashboardStations.length > 0 || comparisonStations.length > 0;

  const projectNameMap = Object.fromEntries(
    (projectsListData || []).map((project) => [String(project.id), project.name]),
  );

  return (
    <div className="space-y-8">
      <PageTitle
        description="選擇專案中的測站，加入儀表板或資料比對"
        actions={
          <>
            <BaseButton onClick={() => navigate("/project/single-site-dashboard")} variant="outline">
              <LayoutDashboard size={16} className="mr-2" />儀表板
            </BaseButton>
            <BaseButton onClick={() => navigate("/project/site-comparison")} variant="outline">
              <ChartNoAxesCombined size={16} className="mr-2" />資料比對
            </BaseButton>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <BaseCard title="選擇專案" subtitle={`共 ${filteredProjects.length} 個專案`}>
            <div className="space-y-4">
              <BaseInput
                placeholder="搜尋專案..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
              <div className="space-y-2">
                <BaseApiLoaderWrapper isLoading={loadingProjectsList} isError={errorProjectsList}>
                  {filteredProjects.length > 0 ? filteredProjects.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => handleProjectClick(project.id)}
                      className={`mb-4 w-full rounded-xl border px-4 py-3 text-left type-body font-medium transition-all ${
                        activeProjectId === project.id
                          ? "border-primary bg-primary text-primary-foreground shadow-[0_8px_18px_rgba(14,165,233,0.18)]"
                          : "border-transparent bg-secondary/60 hover:border-primary/20 hover:bg-primary-light/60"
                      }`}
                    >
                      {project.name}
                    </button>
                  )) : (
                    <p className="py-4 text-center type-body text-muted-foreground ">查無符合的專案</p>
                  )}
                </BaseApiLoaderWrapper>
              </div>
            </div>
          </BaseCard>
        </div>

        <BaseCard title="已選測站" subtitle="" className="h-fit lg:sticky lg:top-24">
          {hasSelections ? (
            <div className="space-y-6">
              <SelectionGroup
                title="儀表板"
                stations={dashboardStations}
                projectNameMap={projectNameMap}
                stationNameMap={selectedStationNameMap}
                tone="dashboard"
                onRemove={removeDashboardStation}
                onClear={clearDashboardStations}
              />
              <SelectionGroup
                title="資料比對"
                stations={comparisonStations}
                projectNameMap={projectNameMap}
                stationNameMap={selectedStationNameMap}
                tone="comparison"
                onRemove={removeComparisonStation}
                onClear={clearComparisonStations}
              />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-secondary/40 px-4 py-8 text-center type-body text-muted-foreground ">
              尚未選擇測站
            </div>
          )}
        </BaseCard>
      </div>

      <BaseDialog
        open={isStationDialogOpen}
        onOpenChange={setIsStationDialogOpen}
        title={currentProject.name || "選擇測站"}
        description={`請選擇要加入儀表板或資料比對的測站`}
        hideFooter
        className="flex h-[85vh] flex-col sm:max-w-4xl"
      >
        <div className="flex h-full flex-col space-y-4">
          <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-center gap-2">
              <label className="whitespace-nowrap type-body font-medium ">狀態：</label>
              <BaseSelect
                value={enabled}
                onChange={setEnabled}
                options={[
                  { value: 1, label: "啟用" },
                  { value: 0, label: "停用" },
                ]}
              />
            </div>
            <BaseTab
              value={stationViewMode}
              onChange={setStationViewMode}
              items={[
                { label: "列表", value: "list" },
                { label: "地圖", value: "map" },
              ]}
            />
          </div>
          <BaseApiLoaderWrapper isLoading={loadingStationList} isError={errorStationList} className="flex-1">
            {stationViewMode === "list" && (
              <BaseTable data={currentProject.stations} columns={columns}/>
            )}
            {stationViewMode === "map" && (
              <div className="h-[55vh] min-h-80"><GoogleMap markers={currentProject.stations} /></div>
            )}
          </BaseApiLoaderWrapper>
        </div>
      </BaseDialog>
    </div>
  );
}

function SelectionGroup({ title, stations, projectNameMap, stationNameMap, tone, onRemove, onClear }) {

  if (!stations.length) return null;

  const groupedStations = stations.reduce((groups, station) => {
    const projectId = String(station.PJID);
    if (!groups[projectId]) groups[projectId] = [];
    groups[projectId].push(station);
    return groups;
  }, {});

  const isDashboard = tone === "dashboard";
  const styles = isDashboard
    ? {
      wrapper: "border-sky-200 bg-sky-50/70 dark:border-sky-900 dark:bg-sky-950/30",
      title: "text-sky-700 dark:text-sky-300",
      project: "border-sky-200 dark:border-sky-800",
      station: "bg-white/80 hover:bg-sky-100 dark:bg-sky-950/50 dark:hover:bg-sky-900/60",
      clear: "text-sky-700 hover:bg-sky-100 dark:text-sky-300 dark:hover:bg-sky-900",
    }
    : {
      wrapper: "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30",
      title: "text-emerald-700 dark:text-emerald-300",
      project: "border-emerald-200 dark:border-emerald-800",
      station: "bg-white/80 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60",
      clear: "text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900",
    };

  return (
    <section className={`space-y-3 rounded-xl border p-3 ${styles.wrapper}`}>
      <div className="flex items-center justify-between gap-2">
        <div className={`flex items-center gap-2 type-body font-bold ${styles.title}`}>
          {isDashboard ? <LayoutDashboard size={16} /> : <ChartNoAxesCombined size={16} />}
          <span>{title}</span>
          <span className="rounded-full bg-white/80 px-2 py-0.5 type-meta dark:bg-black/20">{stations.length}</span>
        </div>
        <button
          type="button"
          onClick={onClear}
          className={`rounded-lg px-2 py-1 type-meta font-medium transition-colors ${styles.clear}`}
        >
          清除全部
        </button>
      </div>

      <div className="space-y-3">
        {Object.entries(groupedStations).map(([projectId, projectStations]) => (
          <div key={`${title}-${projectId}`} className={`border-l-2 pl-3 ${styles.project}`}>
            <p className="mb-2 truncate type-meta font-semibold text-muted-foreground " title={projectNameMap[projectId] || projectId}>
              {projectNameMap[projectId] || projectId}
              <span className="ml-1 font-normal">({projectStations.length})</span>
            </p>
            <div className="space-y-1.5">
              {projectStations.map((station) => (
                <div
                  key={`${title}-${station.PJID}-${station.STID}`}
                  className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 type-body transition-colors ${styles.station}`}
                >
                  <span
                    className="min-w-0 truncate"
                    title={stationNameMap[`${station.PJID}::${station.STID}`] || station.STID}
                  >
                    {stationNameMap[`${station.PJID}::${station.STID}`] || station.STID}
                  </span>
                  <button
                    type="button"
                    aria-label={`移除測站 ${station.STID}`}
                    title="移除此測站"
                    onClick={() => onRemove(station.PJID, station.STID)}
                    className="grid size-7 shrink-0 place-items-center rounded-md text-red-500 transition-colors hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-950"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
