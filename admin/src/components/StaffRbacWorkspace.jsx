'use client';
import {useEffect, useMemo, useState} from 'react';
import {adminMutation} from '@/lib/client-api';

const contextPath = context => context.kind === 'PLATFORM' ? 'scopes/platform' : `scopes/tenants/${context.tenantId}${context.kind === 'STORE' ? `/stores/${context.storeId}` : ''}`;
const can = (context, permission) => context.permissions.includes(permission);
const canManageRoles = context => can(context, context.kind === 'PLATFORM' ? 'platform.roles.manage' : 'roles.manage');
const canManageStaff = context => can(context, context.kind === 'PLATFORM' ? 'platform.staff.manage' : 'staff.manage');
const canViewStaff = context => context.kind === 'PLATFORM' ? canManageStaff(context) : can(context, 'staff.view') || canManageStaff(context);
const canAssign = context => canManageRoles(context) && canManageStaff(context);
const canAddMember = context => context.kind === 'PLATFORM' ? canAssign(context) : canManageStaff(context);

async function read(path) {
  const response = await fetch(`/api/admin/${path}`, {cache: 'no-store'});
  const data = await response.json();
  if (!response.ok) throw new Error(data.message ?? 'Unable to load staff access.');
  return data;
}

export default function StaffRbacWorkspace({contexts, currentUserId}) {
  const [contextKey, setContextKey] = useState(contexts[0] ? `${contexts[0].kind}:${contexts[0].id}` : '');
  const context = contexts.find(item => `${item.kind}:${item.id}` === contextKey);
  const [roles, setRoles] = useState([]), [permissions, setPermissions] = useState([]), [members, setMembers] = useState([]);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [loadedKey, setLoadedKey] = useState('');
  const [code, setCode] = useState(''), [name, setName] = useState(''), [grants, setGrants] = useState({}), [editing, setEditing] = useState(null);
  const [email, setEmail] = useState(''), [candidate, setCandidate] = useState(null), [selectedRoles, setSelectedRoles] = useState([]);
  const path = useMemo(() => context ? contextPath(context) : '', [context]);
  const canViewRoles = context && (can(context, context.kind === 'PLATFORM' ? 'platform.roles.view' : 'roles.view') || canManageRoles(context));
  const delegable = new Set(permissions.map(item => item.code));
  const roleIsAssignable = role => role.owner ? Boolean(context?.owner) : role.permissions.every(grant => delegable.has(grant.supportedScope.permission.code));

  async function refresh() {
    if (!context) return;
    setLoadedKey('');
    setError(''); setNotice('');
    const jobs = [];
    if (canViewRoles) jobs.push(read(`${path}/roles`).then(setRoles)); else setRoles([]);
    if (canManageRoles(context)) jobs.push(read(`${path}/permissions`).then(setPermissions)); else setPermissions([]);
    if (canViewStaff(context)) jobs.push(read(`${path}/members`).then(setMembers)); else setMembers([]);
    const results = await Promise.allSettled(jobs);
    const failed = results.find(result => result.status === 'rejected');
    if (failed) setError(failed.reason.message); else setLoadedKey(contextKey);
  }
  useEffect(() => {
    let cancelled = false;
    if (!context) return () => { cancelled = true; };
    const jobs = [
      canViewRoles ? read(`${path}/roles`) : Promise.resolve([]),
      canManageRoles(context) ? read(`${path}/permissions`) : Promise.resolve([]),
      canViewStaff(context) ? read(`${path}/members`) : Promise.resolve([]),
    ];
    Promise.all(jobs).then(([nextRoles, nextPermissions, nextMembers]) => {
      if (cancelled) return;
      setRoles(nextRoles); setPermissions(nextPermissions); setMembers(nextMembers); setError(''); setLoadedKey(contextKey);
    }).catch(cause => { if (!cancelled) setError(cause.message); });
    return () => { cancelled = true; };
  }, [context, contextKey, path, canViewRoles]);

  function resetRole() { setEditing(null); setCode(''); setName(''); setGrants({}); }
  function editRole(role) {
    setEditing(role); setCode(role.code); setName(role.name);
    setGrants(Object.fromEntries(role.permissions.map(grant => [grant.supportedScope.permission.code, grant.canDelegate])));
  }
  async function saveRole(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const selected = Object.entries(grants).map(([permission, canDelegate]) => ({code: permission, canDelegate: Boolean(canDelegate)}));
      if (editing) await adminMutation(`${path}/roles/${editing.id}`, {name, grants: selected}, 'PATCH');
      else await adminMutation(`${path}/roles`, {code: code.toUpperCase(), name, grants: selected});
      resetRole(); setNotice('Role saved.'); await refresh();
    } catch (cause) { setError(cause.message); } finally { setBusy(false); }
  }
  async function saveAssignments(member) {
    setBusy(true); setError(''); setNotice('');
    try { await adminMutation(`${path}/members/${member.id}/roles`, {roleIds: member.roleIds ?? []}); setNotice(`Access updated for ${member.name}.`); await refresh(); }
    catch (cause) { setError(cause.message); } finally { setBusy(false); }
  }
  async function addMember() {
    if (!candidate) return;
    setBusy(true); setError(''); setNotice('');
    try {
      if (context.kind === 'PLATFORM') await adminMutation(`${path}/members/${candidate.id}/roles`, {roleIds: selectedRoles});
      else await adminMutation(`${path}/members`, {userId: candidate.id});
      setNotice(context.kind === 'PLATFORM' ? 'Platform role assignment saved.' : 'Membership added without granting a role. Assign only the permissions you are authorized to delegate.');
      setCandidate(null); setEmail(''); setSelectedRoles([]); await refresh();
    } catch (cause) { setError(cause.message); } finally { setBusy(false); }
  }
  async function lookup(event) {
    event.preventDefault(); setBusy(true); setCandidate(null); setError('');
    try { setCandidate(await read(`${path}/members/lookup?email=${encodeURIComponent(email.trim())}`)); }
    catch (cause) { setError(cause.message); } finally { setBusy(false); }
  }
  async function revoke(member) {
    if (!window.confirm(`Revoke ${member.name}'s membership in this context?`)) return;
    setBusy(true); setError(''); setNotice('');
    try { await adminMutation(`${path}/members/${member.id}/revoke`, {}); setNotice('Membership revoked.'); await refresh(); }
    catch (cause) { setError(cause.message); } finally { setBusy(false); }
  }
  if (!contexts.length) return <p className="muted">No authorized tenant or store staff contexts are available for this account.</p>;
  return <section className="rbac-workspace" aria-label="Scoped staff and role management">
    <label htmlFor="rbac-context">Authorization context</label>
    <select id="rbac-context" value={contextKey} onChange={event => {setContextKey(event.target.value); resetRole(); setCandidate(null);}}>
      {contexts.map(item => <option key={`${item.kind}:${item.id}`} value={`${item.kind}:${item.id}`}>{item.kind} · {item.name}{item.tenantName ? ` (${item.tenantName})` : ''}</option>)}
    </select>
    {context ? <p className="field-help">Permissions apply only to the selected {context.kind.toLowerCase()} context. Platform access does not grant tenant or store access.</p> : null}
    {error ? <p role="alert" className="form-error">{error}</p> : null}{notice ? <p role="status" className="status-badge">{notice}</p> : null}{loadedKey !== contextKey ? <p role="status" className="muted">Loading access for this context…</p> : null}
    {loadedKey === contextKey && canAddMember(context) ? <section className="rbac-card"><h2>{context.kind === 'PLATFORM' ? 'Assign platform staff' : 'Add existing staff account'}</h2><p className="muted">This finds an existing active admin account by exact email. It does not create accounts, send invitations or set passwords.</p>
      <form onSubmit={lookup}><label htmlFor="member-email">Account email</label><input id="member-email" type="email" autoComplete="off" required value={email} onChange={event => setEmail(event.target.value)} /><button className="secondary-button" disabled={busy}>Find account</button></form>
      {candidate ? <div className="rbac-candidate"><strong>{candidate.name}</strong><span>{candidate.email}</span>{candidate.id === currentUserId ? <p className="form-error">You cannot grant access to your own account.</p> : context.kind === 'PLATFORM' ? <fieldset className="staff-roles"><legend>Authorized roles to assign</legend>{roles.filter(role => !role.system && !role.owner && roleIsAssignable(role)).map(role => <label key={role.id}><input type="checkbox" checked={selectedRoles.includes(role.id)} onChange={event => setSelectedRoles(value => event.target.checked ? [...value, role.id] : value.filter(id => id !== role.id))} />{role.name}</label>)}</fieldset> : null}{candidate.id !== currentUserId ? <button className="primary-button" onClick={addMember} disabled={busy || context.kind === 'PLATFORM' && !selectedRoles.length}>{context.kind === 'PLATFORM' ? 'Assign selected roles' : 'Add membership'}</button> : null}</div> : null}
    </section> : null}
    {loadedKey === contextKey && canViewStaff(context) ? <section className="rbac-card"><h2>Staff memberships</h2>{members.length ? <div className="rbac-member-list">{members.map(member => <article className="rbac-member" key={member.id}><header><div><strong>{member.name}</strong><span>{member.email}</span></div><span className={`status-badge${member.active === false || member.membershipActive === false ? ' status-inactive' : ''}`}>{member.active === false ? 'Account disabled' : member.membershipActive === false ? 'Revoked' : 'Active'}</span></header>
      {canAssign(context) && member.id !== currentUserId && member.active && member.membershipActive !== false ? <fieldset className="staff-roles"><legend>Roles in this context</legend>{roles.map(role => <label key={role.id}><input type="checkbox" checked={(member.roleIds ?? []).includes(role.id)} disabled={!roleIsAssignable(role) || role.owner && !context.owner} onChange={event => setMembers(current => current.map(item => item.id === member.id ? {...item, roleIds: event.target.checked ? [...item.roleIds, role.id] : item.roleIds.filter(id => id !== role.id)} : item))} />{role.name}{role.owner ? ' · protected Owner' : ''}{!roleIsAssignable(role) ? <span className="field-help">Not delegated to you</span> : null}</label>)}<button className="secondary-button" disabled={busy || roles.some(role => (member.roleIds ?? []).includes(role.id) && !roleIsAssignable(role))} onClick={() => saveAssignments(member)}>Save role assignment</button></fieldset> : <p className="field-help">Roles: {(member.roleNames ?? []).join(', ') || 'none'}</p>}
      {canManageStaff(context) && context.kind !== 'PLATFORM' && member.id !== currentUserId && member.active && member.membershipActive && <button className="secondary-button" disabled={busy} onClick={() => revoke(member)}>Revoke membership</button>}
    </article>)}</div> : <p className="muted">No staff memberships are listed in this context.</p>}</section> : null}
    {loadedKey === contextKey && canViewRoles ? <section className="rbac-card"><h2>Roles</h2><div className="rbac-role-list">{roles.map(role => <article key={role.id}><div><strong>{role.name}</strong><span>{role.code}{role.owner ? ' · protected Owner' : role.system ? ' · system role' : ''}</span><p>{role.permissions.map(grant => grant.supportedScope.permission.code).join(', ') || 'No permissions'}</p></div>{canManageRoles(context) && !role.system && !role.owner && role.permissions.every(grant => delegable.has(grant.supportedScope.permission.code)) ? <button className="secondary-button" onClick={() => editRole(role)}>Edit</button> : null}</article>)}</div>
      {canManageRoles(context) ? <form className="rbac-role-form" onSubmit={saveRole}><h3>{editing ? `Edit ${editing.name}` : 'Create custom role'}</h3>{!editing ? <><label htmlFor="role-code">Role code</label><input id="role-code" required pattern="[A-Za-z][A-Za-z0-9_]{1,49}" value={code} onChange={event => setCode(event.target.value)} /></> : null}<label htmlFor="role-name">Role name</label><input id="role-name" required minLength="2" maxLength="100" value={name} onChange={event => setName(event.target.value)} /><fieldset className="staff-roles"><legend>Permissions you are authorized to delegate</legend>{permissions.map(item => <label key={item.code}><input type="checkbox" checked={Object.hasOwn(grants, item.code)} onChange={event => setGrants(current => {const next={...current};if(event.target.checked)next[item.code]=false;else delete next[item.code];return next;})} />{item.code}{Object.hasOwn(grants,item.code) ? <span><input aria-label={`Allow delegation of ${item.code}`} type="checkbox" checked={Boolean(grants[item.code])} onChange={event => setGrants(current => ({...current,[item.code]:event.target.checked}))} /> Allow this role to delegate</span> : null}</label>)}</fieldset><div className="rbac-actions"><button className="primary-button" disabled={busy}>{editing ? 'Save role' : 'Create role'}</button>{editing ? <button className="secondary-button" type="button" onClick={resetRole}>Cancel</button> : null}</div></form> : null}
    </section> : null}
  </section>;
}
