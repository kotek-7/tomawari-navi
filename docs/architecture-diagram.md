# システム構成図

```mermaid
flowchart TB
    %% Top layer
    db[(postgresql DB)]
    osm[OSM]
    gmap[google map]

    %% Backend layer
    subgraph backend[backend (Python fastapi)]
      sightseeing[経路生成（観光）]
      health[経路生成（健康）]
    end

    %% Frontend layer
    subgraph frontend[vite + react + tailwind frontend]
      ui[入力フォーム + 地図UI]
    end

    %% Connections inferred from the image
    db --> sightseeing
    db --> health

    osm --> sightseeing
    osm --> health

    sightseeing --> ui
    health --> ui

    gmap --> ui

    %% Optional visual grouping
    classDef ext fill:#f7f7f7,stroke:#666,stroke-width:1px;
    classDef app fill:#e8f5e9,stroke:#2e7d32,stroke-width:1px;

    class db,osm,gmap ext;
    class sightseeing,health,ui app;
```
