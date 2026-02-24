from __future__ import annotations

from datetime import datetime
from math import isfinite
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


class LatLng(BaseModel):
    lat: float = Field(ge=-90.0, le=90.0)
    lng: float = Field(ge=-180.0, le=180.0)


class RouteRequest(BaseModel):
    origin: LatLng | None = None
    destination: LatLng | None = None
    origin_text: str | None = Field(default=None, min_length=1, max_length=200)
    destination_text: str | None = Field(default=None, min_length=1, max_length=200)
    genre: Literal["sightseeing"] = "sightseeing"
    start_time_iso: str | None = None
    target_minutes: int | None = Field(default=None, ge=10, le=240)
    weight_kg: float = Field(default=60.0, ge=30.0, le=150.0)

    @field_validator("origin_text", "destination_text")
    @classmethod
    def _validate_place_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("must not be blank")
        return trimmed

    @field_validator("start_time_iso")
    @classmethod
    def _validate_start_time_iso(cls, value: str | None) -> str | None:
        if value is None:
            return None
        try:
            datetime.fromisoformat(value)
        except ValueError as e:
            raise ValueError("must be ISO-8601 datetime format") from e
        return value

    @model_validator(mode="after")
    def _validate_points_or_text(self) -> "RouteRequest":
        if self.origin is None and self.origin_text is None:
            raise ValueError("origin or origin_text is required")
        if self.destination is None and self.destination_text is None:
            raise ValueError("destination or destination_text is required")
        return self


class GeoJSONLineString(BaseModel):
    type: Literal["LineString"] = "LineString"
    coordinates: list[list[float]]

    @field_validator("coordinates")
    @classmethod
    def _validate_coordinates(cls, coordinates: list[list[float]]) -> list[list[float]]:
        if len(coordinates) < 2:
            raise ValueError("LineString must have at least 2 coordinates")
        for idx, point in enumerate(coordinates):
            if len(point) != 2:
                raise ValueError(f"coordinate at index {idx} must be [lng, lat]")
            lng, lat = point
            if not (isfinite(lng) and isfinite(lat)):
                raise ValueError(f"coordinate at index {idx} must be finite numbers")
            if lng < -180.0 or lng > 180.0 or lat < -90.0 or lat > 90.0:
                raise ValueError(f"coordinate at index {idx} is out of range")
        return coordinates


class RouteGeometry(BaseModel):
    geojson: GeoJSONLineString


class ViaSpot(BaseModel):
    lat: float
    lng: float
    name: str
    type: str
    description: str


class NearbySpot(ViaSpot):
    distance_m: int = Field(ge=0)


class NearbySpotsRequest(BaseModel):
    current: LatLng
    radius_m: int = Field(default=800, ge=50, le=5000)
    limit: int = Field(default=10, ge=1, le=50)


class NearbySpotsResponse(BaseModel):
    status: Literal["ok"]
    current: LatLng
    radius_m: int
    spots: list[NearbySpot]


class Summary(BaseModel):
    distance_m: int
    duration_s: int
    eta_iso: str
    calories_kcal: int


class RouteResponse(BaseModel):
    status: Literal["ok"]
    route_id: str
    genre: Literal["sightseeing"]
    origin: LatLng
    destination: LatLng
    route: RouteGeometry
    summary: Summary
    via_spots: list[ViaSpot]
    along_route_spots: list[ViaSpot] = Field(default_factory=list)
