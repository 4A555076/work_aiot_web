import { useEffect, useState } from "react";
import { getUserPages } from "@/api/user";

export function useMenuData() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMenu = async () => {
      try {
        const response = await getUserPages();
        
        if (Array.isArray(response)) {
          const validPages = response.filter(item => item.category && item.pageName);

          const groups = validPages.reduce((acc, item) => {
            const { category, PAGE, pageName, serial } = item;
            
            if (!acc[category]) {
              acc[category] = [];
            }
            
            acc[category].push({
              path: `/${PAGE}`,
              name: pageName,
              serial: serial || ""
            });
            
            return acc;
          }, {});

          const formattedMenu = Object.keys(groups).map(categoryName => {
            const sortedItems = groups[categoryName].sort((a, b) => 
              a.serial.localeCompare(b.serial, undefined, { numeric: true, sensitivity: 'base' })
            );

            return {
              category: categoryName,
              items: sortedItems
            };
          });

          formattedMenu.sort((a, b) => {
            const aFirstSerial = a.items[0]?.serial || "";
            const bFirstSerial = b.items[0]?.serial || "";
            return aFirstSerial.localeCompare(bFirstSerial, undefined, { numeric: true, sensitivity: 'base' });
          });

          setData(formattedMenu);
        }
      } catch (err) {
        console.error("error:", err);
        const errMsg = err?.response?.data?.message || err?.message || "取得失敗";
        setError(errMsg);
      } finally {
        setLoading(false);
      }
    };

    fetchMenu();
  }, []);

  return { data, loading, error };
}