import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export const EMPTY_PROFILE = {
  fullName: '',
  dni: '',
  phone: '',
  birthDate: '',
  bloodType: '',
  vehicle: { type: 'Moto', brandModel: '', plate: '' },
  lifeInsurance: { has: null, company: '', policy: '' },
  vehicleInsurance: { has: null, company: '', policy: '' },
  emergencyContact: { name: '', relationship: '', phone: '' },
};

function profileRef(uid) {
  return doc(db, 'users', uid);
}

export async function loadProfile(uid) {
  const snap = await getDoc(profileRef(uid));
  return snap.exists() ? snap.data() : null;
}

export async function saveProfile(uid, email, profile) {
  const data = { ...profile, email, completed: true, updatedAt: serverTimestamp() };
  await setDoc(profileRef(uid), data, { merge: true });
  return data;
}

// Devuelve un objeto { campo: mensaje } con los errores del formulario.
export function validateProfile(p) {
  const errors = {};
  const phoneOk = (v) => /^[+\d][\d\s-]{6,}$/.test(v.trim());

  if (p.fullName.trim().length < 3) errors.fullName = 'Ingresá tu nombre completo';
  if (!/^\d{7,9}$/.test(p.dni.replace(/\./g, ''))) errors.dni = 'DNI inválido (solo números)';
  if (!phoneOk(p.phone)) errors.phone = 'Teléfono inválido';
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(p.birthDate)) errors.birthDate = 'Usá el formato DD/MM/AAAA';
  if (!p.vehicle.brandModel.trim()) errors.vehicleBrandModel = 'Indicá marca y modelo';
  if (!p.vehicle.plate.trim()) errors.vehiclePlate = 'Indicá la patente';

  for (const key of ['lifeInsurance', 'vehicleInsurance']) {
    const ins = p[key];
    if (ins.has === null) errors[key] = 'Elegí Sí o No';
    else if (ins.has && !ins.company.trim()) errors[`${key}Company`] = 'Indicá la aseguradora';
  }

  const ec = p.emergencyContact;
  if (ec.name.trim().length < 3) errors.ecName = 'Ingresá el nombre del contacto';
  if (!ec.relationship.trim()) errors.ecRelationship = 'Indicá el vínculo';
  if (!phoneOk(ec.phone)) errors.ecPhone = 'Teléfono inválido';
  return errors;
}
