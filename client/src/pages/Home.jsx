import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Headphones, LocateFixed, Mail, Navigation, Phone, Search, User, Activity } from "lucide-react";
import BaseTab from "@/components/common/tab/BaseTab";
import BaseButton from "@/components/common/button/BaseButton";
import BaseInput from "@/components/common/input/BaseInput";
import BaseSelect from "@/components/common/select/BaseSelect";
import BaseCard from "@/components/common/card/BaseCard";
import BaseApiLoaderWrapper from "@/components/common/api/ApiLoaderWrapper";
import { useAuthorizedStationsData, useNearbyStationsData } from "@/hook/useHome";
import { addDashboardStation } from "@/utils/stationSelectionStorage";

export default function HomePage() {
  const navigate = useNavigate();
  const [searchMode, setSearchMode] = useState("manual");
  const [nearbyMode, setNearbyMode] = useState("radius");
  const [radius, setRadius] = useState("500");
  const [nearest, setNearest] = useState("5");
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState(null);
  const [gpsError, setGpsError] = useState("正在獲取您的當前位置...");

  const {
    data: nearbyStationsData,
    loading: loadingNearbyStations,
    error: errorNearbyStations,
    fetchNearbyStationsData,
  } = useNearbyStationsData();

  const {
    data: authorizedStationsData,
    loading: loadingAuthorizedStations,
    error: errorAuthorizedStations,
    fetchAuthorizedStationsData,
  } = useAuthorizedStationsData();

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGpsError("您的瀏覽器不支援地理定位功能");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setGpsError(null);
      },
      (error) => {
        console.error(error);
        setGpsError(error.code === error.PERMISSION_DENIED ? "您拒絕了定位權限" : "無法取得當前定位");
      },
    );
  }, []);

  const runSearch = async () => {
    if (!location) return;
    const { lat, lng } = location;

    try {
      if (searchMode === "nearby") {
        await fetchNearbyStationsData(
          nearbyMode === "radius"
            ? { lat, lng, radius: Number(radius || 500) }
            : { lat, lng, nearest: Number(nearest || 5) },
        );
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (!location || searchMode === "manual") return;
    runSearch();
  }, [searchMode, nearbyMode, location]);

  const handleSearch = () => {
    if (searchMode === "manual") {
      fetchAuthorizedStationsData({ enabled: 1, stidOrIit: keyword });
      return;
    }
    runSearch();
  };

  const handleOpenDashboard = (item) => {
    const station = {
      PJID: String(item.PJID ?? item.ProjID ?? "").trim(),
      STID: String(item.STID ?? "").trim(),
    };
    const result = addDashboardStation(station);

    if (!result.added && result.reason !== "duplicate") return;
    navigate(`/project/single-site-dashboard?station=${encodeURIComponent(`${station.PJID}::${station.STID}`)}`);
  };

  const isLoading = loadingNearbyStations || loadingAuthorizedStations;
  const isError = errorNearbyStations || errorAuthorizedStations;
  const searchResult = searchMode === "nearby" ? nearbyStationsData : authorizedStationsData;

  return (
<div className="space-y-8">
  {/* 首頁入口 */}
  <section className="relative isolate overflow-hidden rounded-2xl border border-primary/15 bg-linear-to-br from-card via-primary/5 to-info/10 px-5 py-6 text-foreground sm:px-7 sm:py-8 lg:px-8">
    <div className="absolute -right-20 -top-24 size-60 rounded-full border-50 border-primary/10" />
    <div className="absolute -bottom-32 left-1/3 size-72 rounded-full bg-info/10 blur-3xl" />

    <div className="relative max-w-3xl">
      <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 type-meta font-semibold text-primary">
        <Activity size={14} />
        環境監測資料平台
      </div>

      <p className="mt-3 max-w-2xl type-body leading-relaxed text-muted-foreground">
        從附近測站或測站編號開始搜尋，找到測站後即可查看即時監測、
        趨勢圖表、歷史資料與各類分析報表。
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <BaseButton
          className="h-11"
          onClick={() =>
            document
              .getElementById("station-search")
              ?.scrollIntoView({ behavior: "smooth" })
          }
        >
          開始尋找測站
          <ArrowRight size={16} />
        </BaseButton>

        <div className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card/80 px-3 type-body shadow-sm">
          <Navigation
            size={16}
            className={location ? "text-success" : "text-muted-foreground"}
          />

          <span
            className={
              location ? "font-medium text-success" : "text-muted-foreground"
            }
          >
            {location ? "定位服務已就緒，可搜尋附近測站" : gpsError}
          </span>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-border/70 pt-5 type-meta text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-primary" />
          即時監測
        </span>

        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-info" />
          圖表分析
        </span>

        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-success" />
          歷史報表
        </span>
      </div>
    </div>
  </section>

  <section
    id="station-search"
    className="grid scroll-mt-24 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]"
  >
    <BaseCard
      title="找到你要查看的測站"
      subtitle="可以使用目前位置尋找附近測站，也可以直接輸入測站編號"
      headerRight={
        <BaseTab
          value={searchMode}
          onChange={setSearchMode}
          items={[
            { label: "附近測站", value: "nearby" },
            { label: "手動查詢", value: "manual" },
          ]}
        />
      }
    >
      <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 sm:p-5">
        <div className="mb-4">
          <p className="type-meta font-semibold text-primary">
            STEP 1 · 設定搜尋條件
          </p>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          {searchMode === "nearby" ? (
            <>
              <div className="w-full shrink-0 lg:w-44">
                <BaseSelect
                  label="搜尋方式"
                  value={nearbyMode}
                  onChange={setNearbyMode}
                  options={[
                    { label: "搜尋半徑", value: "radius" },
                    { label: "回傳筆數", value: "count" },
                  ]}
                  placeholder="請選擇搜尋方式"
                />
              </div>

              <div className="min-w-0 flex-1">
                <BaseInput
                  label={
                    nearbyMode === "radius" ? "半徑（公尺）" : "測站筆數"
                  }
                  type="number"
                  value={nearbyMode === "radius" ? radius : nearest}
                  onChange={(event) =>
                    nearbyMode === "radius"
                      ? setRadius(event.target.value)
                      : setNearest(event.target.value)
                  }
                  placeholder={
                    nearbyMode === "radius" ? "例如：500" : "例如：5"
                  }
                />
              </div>
            </>
          ) : (
            <div className="min-w-0 flex-1">
              <BaseInput
                label="測站關鍵字"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="輸入 STID / IIT"
              />
            </div>
          )}

          <BaseButton
            className="h-11 w-full shrink-0 lg:w-auto"
            onClick={handleSearch}
            disabled={searchMode === "nearby" && !location}
          >
            <Search size={16} />
            查詢測站
          </BaseButton>
        </div>
      </div>

      {searchMode === "nearby" && gpsError && !location && (
        <p className="mt-4 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 type-body text-warning">
          {gpsError}
        </p>
      )}

      {/* 搜尋結果 */}
      <div className="mt-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="type-meta font-semibold text-primary">
              STEP 2 · 選擇測站
            </p>

            <h3 className="mt-1 font-bold text-foreground">
              {searchResult?.length
                ? "選擇一座測站開始查看"
                : "搜尋結果"}
            </h3>

          </div>

          {location && searchMode === "nearby" && (
            <span className="inline-flex items-center gap-2 rounded-full bg-success/10 px-3 py-1.5 type-body font-semibold text-success">
              <span className="size-2 rounded-full bg-success" />
              定位正常
            </span>
          )}
        </div>

        <BaseApiLoaderWrapper isLoading={isLoading} isError={isError}>
          {searchResult?.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
              {searchResult.map((item) => (
                <article
                  key={item.STID}
                  className="
                    group relative overflow-hidden rounded-2xl
                    border border-border bg-card p-4
                    transition-all
                    hover:-translate-y-0.5
                    hover:border-primary/40
                    hover:shadow-card
                  "
                >
                  <div className="absolute right-0 top-0 size-20 rounded-bl-full bg-primary/5 transition-colors group-hover:bg-primary/10" />

                  <div className="relative flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-lg border border-primary/15 bg-primary/10 px-2 py-1 type-meta font-bold uppercase tracking-wider text-primary">
                          {item.ProjID}
                        </span>

                        <span className="font-mono type-body font-semibold text-muted-foreground">
                          {item.PJName_TW}
                        </span>
                      </div>

                      <h4 className="mt-3 truncate font-bold text-foreground">
                        ({item.STID}) {item.IIT}
                      </h4>

                      <p className="mt-1 line-clamp-2 type-body leading-relaxed text-muted-foreground">
                        {item.Desc}
                      </p>
                    </div>

                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                      <LocateFixed size={18} />
                    </span>
                  </div>

                  <div className="relative mt-4 flex items-center justify-between gap-3 border-t border-border pt-3 type-body">
                    {item.distance != null ? (
                      <div className="min-w-0">
                        <span className="text-muted-foreground">
                          距離目前位置
                        </span>

                        <span className="ml-2 font-bold text-primary">
                          {item.distance}
                        </span>
                      </div>
                    ) : (
                      <span />
                    )}

                    <BaseButton
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenDashboard(item)}
                    >
                      查看測站
                      <ArrowRight size={14} />
                    </BaseButton>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-secondary/40 px-5 text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Search size={21} />
              </span>

              <p className="mt-4 font-semibold text-foreground">
                還沒有搜尋結果
              </p>

              <p className="mt-1 max-w-sm type-body text-muted-foreground">
                可以使用「附近測站」快速尋找，或切換成「手動查詢」輸入測站編號。
              </p>
            </div>
          )}
        </BaseApiLoaderWrapper>
      </div>
    </BaseCard>

    {/* 操作說明 / 聯絡資訊 */}
    <aside className="space-y-5">
      <BaseCard
        title="第一次使用？"
        subtitle="只需要三個步驟"
      >
        <div className="space-y-4">
          {[
            {
              step: "1",
              title: "選擇搜尋方式",
              description: "使用目前位置，或直接輸入測站編號。",
            },
            {
              step: "2",
              title: "找到測站",
              description: "從搜尋結果選擇想查看的監測站。",
            },
            {
              step: "3",
              title: "進入儀表板",
              description: "查看即時數據、圖表分析與歷史報表。",
            },
          ].map(({ step, title, description }) => (
            <div key={step} className="flex gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 type-meta font-bold text-primary">
                {step}
              </span>

              <div>
                <p className="font-semibold text-foreground">
                  {title}
                </p>

                <p className="mt-0.5 type-meta leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </BaseCard>

      <BaseCard
        title="需要協助？"
        subtitle="系統操作與資料服務支援"
        className="overflow-hidden"
      >
        <div className="-mx-5 -mt-5 mb-5 bg-linear-to-r from-info to-primary p-5 text-primary-foreground sm:-mx-6 sm:-mt-6">
          <Headphones size={28} />

          <p className="mt-2 type-body leading-relaxed text-primary-foreground/80">
            若對監測資料或系統操作有疑問，歡迎聯繫我們。
          </p>
        </div>

        <div className="space-y-4">
          {[
            {
              icon: User,
              label: "負責人",
              value: "李先生",
            },
            {
              icon: Mail,
              label: "電子郵件",
              value: "wilson@jsene.com",
            },
            {
              icon: Phone,
              label: "聯繫電話",
              value: "(07) 3312152 #306",
            },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-info/10 text-info">
                <Icon size={17} />
              </span>

              <div className="min-w-0">
                <p className="type-meta uppercase tracking-wider text-muted-foreground">
                  {label}
                </p>

                <p className="truncate font-semibold text-foreground">
                  {value}
                </p>
              </div>
            </div>
          ))}
        </div>
      </BaseCard>
    </aside>
  </section>
</div>
  );
}
