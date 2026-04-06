import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  APIProvider,
  AdvancedMarker,
  Map,
  useAdvancedMarkerRef,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { MapPin, Navigation, Search, X, Check, Loader2 } from 'lucide-react';

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

interface LatLng {
  lat: number;
  lng: number;
}

interface AddressPickerModalProps {
  initialAddress?: string;
  onConfirm: (address: string, coords: LatLng) => void;
  onClose: () => void;
}

// ─── Inner component (has access to map context) ───────────────────────────
const MapPicker: React.FC<{
  position: LatLng;
  onPositionChange: (pos: LatLng, address: string) => void;
  onAddressLoading: (v: boolean) => void;
}> = ({ position, onPositionChange, onAddressLoading }) => {
  const map = useMap();
  const geocodingLib = useMapsLibrary('geocoding');
  const geocoder = useRef<google.maps.Geocoder | null>(null);
  const [markerRef, marker] = useAdvancedMarkerRef();

  useEffect(() => {
    if (geocodingLib && !geocoder.current) {
      geocoder.current = new geocodingLib.Geocoder();
    }
  }, [geocodingLib]);

  const reverseGeocode = useCallback(
    (pos: LatLng) => {
      if (!geocoder.current) return;
      onAddressLoading(true);
      geocoder.current.geocode({ location: pos }, (results, status) => {
        onAddressLoading(false);
        if (status === 'OK' && results && results[0]) {
          onPositionChange(pos, results[0].formatted_address);
        } else {
          onPositionChange(pos, `${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`);
        }
      });
    },
    [onPositionChange, onAddressLoading],
  );

  // Pan map and move marker when position changes externally (e.g. GPS or autocomplete)
  useEffect(() => {
    if (map) map.panTo(position);
    if (marker) marker.position = position;
  }, [map, marker, position]);

  const handleDragEnd = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      reverseGeocode(pos);
    },
    [reverseGeocode],
  );

  return (
    <AdvancedMarker
      ref={markerRef}
      position={position}
      draggable
      onDragEnd={handleDragEnd}
    />
  );
};

// ─── Autocomplete input ─────────────────────────────────────────────────────
const PlacesAutocomplete: React.FC<{
  value: string;
  onChange: (v: string) => void;
  onSelect: (address: string, pos: LatLng) => void;
}> = ({ value, onChange, onSelect }) => {
  const placesLib = useMapsLibrary('places');
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [open, setOpen] = useState(false);
  const serviceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const geocodingLib = useMapsLibrary('geocoding');
  const geocoder = useRef<google.maps.Geocoder | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (placesLib && !serviceRef.current) {
      serviceRef.current = new placesLib.AutocompleteService();
    }
  }, [placesLib]);

  useEffect(() => {
    if (geocodingLib && !geocoder.current) {
      geocoder.current = new geocodingLib.Geocoder();
    }
  }, [geocodingLib]);

  const fetchSuggestions = useCallback((input: string) => {
    if (!serviceRef.current || input.length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    serviceRef.current.getPlacePredictions(
      { input, types: ['address'] },
      (preds, status) => {
        if (status === 'OK' && preds) {
          setSuggestions(preds);
          setOpen(true);
        } else {
          setSuggestions([]);
          setOpen(false);
        }
      },
    );
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    onChange(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(v), 300);
  };

  const handleSelect = (pred: google.maps.places.AutocompletePrediction) => {
    setOpen(false);
    onChange(pred.description);
    if (!geocoder.current) return;
    geocoder.current.geocode({ placeId: pred.place_id }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        const loc = results[0].geometry.location;
        onSelect(pred.description, { lat: loc.lat(), lng: loc.lng() });
      }
    });
  };

  return (
    <div className="relative">
      <div className="relative flex items-center">
        <Search size={16} className="absolute left-3.5 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={value}
          onChange={handleInput}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Buscar dirección..."
          className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
        />
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
          {suggestions.map((s) => (
            <li
              key={s.place_id}
              onMouseDown={() => handleSelect(s)}
              className="px-4 py-3 text-sm text-slate-700 hover:bg-primary-50 cursor-pointer flex items-start gap-2.5 border-b border-slate-100 last:border-0"
            >
              <MapPin size={14} className="text-slate-400 mt-0.5 shrink-0" />
              <span>
                <span className="font-medium">{s.structured_formatting.main_text}</span>
                <span className="text-slate-400 text-xs block">{s.structured_formatting.secondary_text}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ─── Main modal ─────────────────────────────────────────────────────────────
const ModalContent: React.FC<AddressPickerModalProps> = ({ initialAddress, onConfirm, onClose }) => {
  const DEFAULT_POS: LatLng = { lat: -34.6037, lng: -58.3816 }; // Buenos Aires

  const [position, setPosition] = useState<LatLng>(DEFAULT_POS);
  const [address, setAddress] = useState(initialAddress || '');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);
  const geocodingLib = useMapsLibrary('geocoding');
  const geocoder = useRef<google.maps.Geocoder | null>(null);

  useEffect(() => {
    if (geocodingLib && !geocoder.current) {
      geocoder.current = new geocodingLib.Geocoder();
    }
  }, [geocodingLib]);

  // If there's an initial address, geocode it to place the pin
  useEffect(() => {
    if (!initialAddress || !geocoder.current) return;
    geocoder.current.geocode({ address: initialAddress }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        const loc = results[0].geometry.location;
        setPosition({ lat: loc.lat(), lng: loc.lng() });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geocoder.current]);

  const handleGPS = () => {
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPosition(coords);
        if (geocoder.current) {
          setAddressLoading(true);
          geocoder.current.geocode({ location: coords }, (results, status) => {
            setAddressLoading(false);
            if (status === 'OK' && results && results[0]) {
              setAddress(results[0].formatted_address);
            }
          });
        }
        setGpsLoading(false);
      },
      () => setGpsLoading(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const handleMapPositionChange = (pos: LatLng, addr: string) => {
    setPosition(pos);
    setAddress(addr);
  };

  const handleAutocompleteSelect = (addr: string, pos: LatLng) => {
    setAddress(addr);
    setPosition(pos);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-white"
      style={{ maxWidth: 480, margin: '0 auto' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-100 shrink-0">
        <h2 className="font-semibold text-slate-900 text-base">Confirmar ubicación</h2>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
        >
          <X size={18} className="text-slate-500" />
        </button>
      </div>

      {/* Search + GPS */}
      <div className="px-4 pt-3 pb-2 space-y-2 shrink-0">
        <PlacesAutocomplete
          value={address}
          onChange={setAddress}
          onSelect={handleAutocompleteSelect}
        />
        <button
          type="button"
          onClick={handleGPS}
          disabled={gpsLoading}
          className="w-full flex items-center justify-center gap-2 py-2.5 border border-slate-200 rounded-2xl text-sm text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-60"
        >
          {gpsLoading ? (
            <Loader2 size={15} className="animate-spin text-primary-500" />
          ) : (
            <Navigation size={15} className="text-primary-500" />
          )}
          Usar mi ubicación actual
        </button>
      </div>

      {/* Hint */}
      <p className="px-4 text-xs text-slate-400 pb-2 shrink-0">
        Podés arrastrar el pin rojo para ajustar la posición exacta.
      </p>

      {/* Map */}
      <div className="flex-1 relative">
        {addressLoading && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 bg-white shadow-md px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs text-slate-600">
            <Loader2 size={12} className="animate-spin" />
            Obteniendo dirección...
          </div>
        )}
        <Map
          mapId="commy-address-picker"
          defaultZoom={15}
          defaultCenter={position}
          gestureHandling="greedy"
          disableDefaultUI
          style={{ width: '100%', height: '100%' }}
        >
          <MapPicker
            position={position}
            onPositionChange={handleMapPositionChange}
            onAddressLoading={setAddressLoading}
          />
        </Map>
      </div>

      {/* Address preview + confirm */}
      <div className="px-4 py-4 border-t border-slate-100 shrink-0 bg-white">
        {address ? (
          <div className="flex items-start gap-2 mb-3 bg-slate-50 rounded-xl px-3 py-2.5">
            <MapPin size={14} className="text-primary-500 mt-0.5 shrink-0" />
            <p className="text-sm text-slate-700 leading-snug">{address}</p>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => onConfirm(address, position)}
          disabled={!address.trim()}
          className="w-full py-3.5 bg-primary-600 text-white font-semibold rounded-2xl text-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Check size={16} />
          Confirmar dirección
        </button>
      </div>
    </div>
  );
};

// ─── Public export (wraps with APIProvider) ─────────────────────────────────
export const AddressPickerModal: React.FC<AddressPickerModalProps> = (props) => {
  if (!MAPS_API_KEY) return null;

  return (
    <APIProvider apiKey={MAPS_API_KEY} libraries={['places', 'geocoding']}>
      <ModalContent {...props} />
    </APIProvider>
  );
};
