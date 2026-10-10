"use client";

import { LocateFixed } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { NumberInput } from "@/components/ui/NumberInput";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { formatArea, PLOT_SHAPES, PLOT_SIDES } from "@/lib/area";
import { FACING_LABEL, FACINGS, PLOT_SHAPE_LABEL } from "@/lib/domain";
import { PlotSketch } from "./PlotSketch";
import { type Errors, type SiteState, sitePlotArea } from "./wizard-state";

interface Props {
  value: SiteState;
  onChange: (v: SiteState) => void;
  errors: Errors;
  /** Engineers may only set GPS. */
  gpsOnly?: boolean;
}

export function SiteFields({ value, onChange, errors, gpsOnly }: Props) {
  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState<string>();
  const set = <K extends keyof SiteState>(k: K, v: SiteState[K]) => onChange({ ...value, [k]: v });
  const area = sitePlotArea(value);

  const locate = () => {
    if (!("geolocation" in navigator)) return setGpsError("This device cannot share its location.");
    setLocating(true);
    setGpsError(undefined);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        onChange({ ...value, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) });
      },
      (err) => {
        setLocating(false);
        setGpsError(err.code === err.PERMISSION_DENIED ? "Location permission was denied. Type it in instead." : "Could not get your location. Type it in instead.");
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  return (
    <div className="grid grid-cols-1 gap-5">
      <section className="grid grid-cols-1 gap-4">
        <h3 className="label-technical text-ink">Location</h3>
        <Button variant="secondary" onClick={locate} loading={locating} className="justify-self-start">
          <LocateFixed className="size-4" aria-hidden /> Use my location
        </Button>
        {gpsError ? <p className="body-sm text-error">{gpsError}</p> : null}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Latitude" htmlFor="s-lat" error={errors.latitude}>
            <NumberInput id="s-lat" value={value.latitude} onChange={(e) => set("latitude", e.target.value)} placeholder="17.385044" invalid={Boolean(errors.latitude)} />
          </Field>
          <Field label="Longitude" htmlFor="s-lng" error={errors.longitude}>
            <NumberInput id="s-lng" value={value.longitude} onChange={(e) => set("longitude", e.target.value)} placeholder="78.486671" invalid={Boolean(errors.longitude)} />
          </Field>
        </div>
        {!value.latitude ? (
          <Notice tone="ink" title="You can add GPS later">
            A reminder stays on the dashboard until the site location is set.
          </Notice>
        ) : null}
        {!gpsOnly ? (
          <Field label="Address" htmlFor="s-addr" error={errors.address}>
            <Textarea id="s-addr" rows={2} value={value.address} onChange={(e) => set("address", e.target.value)} placeholder="Hitech City, Hyderabad, Telangana" />
          </Field>
        ) : null}
      </section>

      {!gpsOnly ? (
        <section className="grid grid-cols-1 gap-4">
          <h3 className="label-technical text-ink">Plot details</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr]">
            <div className="grid grid-cols-1 content-start gap-4">
              <Field label="Plot shape" htmlFor="s-shape" required>
                <Select id="s-shape" value={value.plotShape} onChange={(e) => set("plotShape", e.target.value as SiteState["plotShape"])} options={PLOT_SHAPES.map((s) => ({ value: s, label: PLOT_SHAPE_LABEL[s] }))} />
              </Field>
              {value.plotShape === "IRREGULAR" ? (
                <Field label="Plot area" htmlFor="s-area" required error={errors.plotArea} hint="Irregular plots: enter the area from the survey sketch.">
                  <NumberInput id="s-area" value={value.plotArea} onChange={(e) => set("plotArea", e.target.value)} suffix="SFT" invalid={Boolean(errors.plotArea)} />
                </Field>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {PLOT_SIDES[value.plotShape].map((side) => (
                    <Field key={side.key} label={side.label} htmlFor={`s-${side.key}`} required>
                      <NumberInput id={`s-${side.key}`} value={value.plotSides[side.key] ?? ""} onChange={(e) => set("plotSides", { ...value.plotSides, [side.key]: e.target.value })} suffix="ft" invalid={Boolean(errors.plotSides)} />
                    </Field>
                  ))}
                </div>
              )}
              {errors.plotSides ? <p className="body-sm text-error">{errors.plotSides}</p> : null}
              <div className="border border-ink bg-ink p-3 text-white">
                <p className="label-technical text-hazard">Plot area (auto)</p>
                <p className="label-numeric mt-1">{area !== null ? formatArea(area) : "—"}</p>
                <p className="body-sm text-white/70">Plot area is kept separate from built-up slab area.</p>
              </div>
            </div>
            <PlotSketch shape={value.plotShape} sides={value.plotSides} road={value.nearestRoad} />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Orientation (facing)" htmlFor="s-facing" error={errors.facing}>
              <Select id="s-facing" value={value.facing} onChange={(e) => set("facing", e.target.value as SiteState["facing"])} options={FACINGS.map((f) => ({ value: f, label: FACING_LABEL[f] }))} placeholder="Pick facing" />
            </Field>
            <Field label="Nearest road" htmlFor="s-road" error={errors.nearestRoad}>
              <Input id="s-road" value={value.nearestRoad} onChange={(e) => set("nearestRoad", e.target.value)} placeholder="30 ft road (east side)" />
            </Field>
          </div>
        </section>
      ) : null}
    </div>
  );
}
