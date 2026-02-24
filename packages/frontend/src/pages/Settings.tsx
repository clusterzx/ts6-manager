import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/api/bots.api';
import { authApi } from '@/api/auth.api';
import { serversApi } from '@/api/servers.api';
import { useAuthStore } from '@/stores/auth.store';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Settings as SettingsIcon, Users, Server, Plus, Trash2, Pencil, TestTube, Check, X, Lock, KeyRound } from 'lucide-react';
import { toast } from 'sonner';

export default function Settings() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Settings</h1>

      <Tabs defaultValue="account">
        <TabsList>
          {isAdmin && <TabsTrigger value="connections"><Server className="h-3.5 w-3.5 mr-1" /> Connections</TabsTrigger>}
          <TabsTrigger value="account"><Lock className="h-3.5 w-3.5 mr-1" /> Account</TabsTrigger>
          {isAdmin && <TabsTrigger value="users"><Users className="h-3.5 w-3.5 mr-1" /> Users</TabsTrigger>}
        </TabsList>

        {isAdmin && (
          <TabsContent value="connections" className="mt-4">
            <ConnectionsTab />
          </TabsContent>
        )}

        <TabsContent value="account" className="mt-4">
          <AccountTab />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="users" className="mt-4">
            <UsersTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function AccountTab() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const changePassword = useMutation({
    mutationFn: () => authApi.changePassword(currentPassword, newPassword),
  });

  const handleSubmit = () => {
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    changePassword.mutate(undefined, {
      onSuccess: () => {
        toast.success('Password changed successfully');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error || 'Failed to change password';
        toast.error(msg);
      },
    });
  };

  return (
    <div className="max-w-md">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Change Password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Current Password</Label>
            <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Enter current password" />
          </div>
          <div>
            <Label className="text-xs">New Password</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 6 characters" />
          </div>
          <div>
            <Label className="text-xs">Confirm New Password</Label>
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat new password" />
          </div>
          <Button
            onClick={handleSubmit}
            disabled={!currentPassword || !newPassword || !confirmPassword || changePassword.isPending}
            className="w-full mt-1"
          >
            {changePassword.isPending ? 'Changing...' : 'Change Password'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ConnectionsTab() {
  const qc = useQueryClient();
  const { data: servers, isLoading } = useQuery({ queryKey: ['servers'], queryFn: serversApi.list });
  const createServer = useMutation({ mutationFn: (data: any) => serversApi.create(data), onSuccess: () => qc.invalidateQueries({ queryKey: ['servers'] }) });
  const updateServer = useMutation({ mutationFn: ({ id, data }: any) => serversApi.update(id, data), onSuccess: () => qc.invalidateQueries({ queryKey: ['servers'] }) });
  const deleteServer = useMutation({ mutationFn: (id: number) => serversApi.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['servers'] }) });
  const testServer = useMutation({ mutationFn: (id: number) => serversApi.test(id) });

  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', host: '', webqueryPort: '10080', apiKey: '', useHttps: false, sshPort: '10022', sshUsername: '', sshPassword: '' });

  const serverList = useMemo(() => (Array.isArray(servers) ? servers : []), [servers]);

  if (isLoading) return <PageLoader />;

  const resetForm = () => setForm({ name: '', host: '', webqueryPort: '10080', apiKey: '', useHttps: false, sshPort: '10022', sshUsername: '', sshPassword: '' });

  const handleSave = () => {
    const payload = { ...form, webqueryPort: parseInt(form.webqueryPort), sshPort: parseInt(form.sshPort) };
    if (editId) {
      updateServer.mutate({ id: editId, data: payload }, {
        onSuccess: () => { toast.success('Connection updated'); setEditId(null); setShowAdd(false); resetForm(); },
        onError: () => toast.error('Failed to update'),
      });
    } else {
      createServer.mutate(payload, {
        onSuccess: () => { toast.success('Connection added'); setShowAdd(false); resetForm(); },
        onError: () => toast.error('Failed to create'),
      });
    }
  };

  const openEdit = (server: any) => {
    setForm({
      name: server.name || '',
      host: server.host || '',
      webqueryPort: String(server.webqueryPort || 10080),
      apiKey: server.apiKey || '',
      useHttps: server.useHttps || false,
      sshPort: String(server.sshPort || 10022),
      sshUsername: server.sshUsername || '',
      sshPassword: server.sshPassword || '',
    });
    setEditId(server.id);
    setShowAdd(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Manage TeamSpeak server connections</p>
        <Button size="sm" onClick={() => { resetForm(); setEditId(null); setShowAdd(true); }}><Plus className="h-4 w-4 mr-1" /> Add Connection</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {serverList.map((server: any) => (
          <Card key={server.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">{server.name}</CardTitle>
                <Badge variant={server.enabled ? 'default' : 'secondary'} className="text-[10px]">
                  {server.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <span className="text-muted-foreground">Host</span>
                <span className="font-mono-data">{server.host}:{server.webqueryPort}</span>
                <span className="text-muted-foreground">Protocol</span>
                <span>{server.useHttps ? 'HTTPS' : 'HTTP'}</span>
                <span className="text-muted-foreground">SSH</span>
                <span className="font-mono-data">{server.sshPort || '-'}</span>
              </div>
              <div className="flex items-center gap-1 pt-2">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => testServer.mutate(server.id, {
                  onSuccess: () => toast.success('Connection successful'),
                  onError: () => toast.error('Connection failed'),
                })}>
                  <TestTube className="h-3 w-3 mr-1" /> Test
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openEdit(server)}>
                  <Pencil className="h-3 w-3 mr-1" /> Edit
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(server.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showAdd} onOpenChange={(v) => { if (!v) { setShowAdd(false); setEditId(null); resetForm(); } else setShowAdd(true); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editId ? 'Edit Connection' : 'Add Connection'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="My TS Server" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Host</Label><Input value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} placeholder="127.0.0.1" /></div>
              <div><Label className="text-xs">WebQuery Port</Label><Input type="number" value={form.webqueryPort} onChange={(e) => setForm({ ...form, webqueryPort: e.target.value })} /></div>
            </div>
            <div>
              <Label className="text-xs">API Key</Label>
              <Input value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder={editId ? '(unchanged — enter new key to update)' : 'WebQuery API Key'} type="password" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.useHttps} onCheckedChange={(v) => setForm({ ...form, useHttps: v })} />
              <Label className="text-xs">Use HTTPS</Label>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs">SSH Port</Label><Input type="number" value={form.sshPort} onChange={(e) => setForm({ ...form, sshPort: e.target.value })} /></div>
              <div><Label className="text-xs">SSH User</Label><Input value={form.sshUsername} onChange={(e) => setForm({ ...form, sshUsername: e.target.value })} placeholder="serveradmin" /></div>
              <div><Label className="text-xs">SSH Password</Label><Input type="password" value={form.sshPassword} onChange={(e) => setForm({ ...form, sshPassword: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAdd(false); setEditId(null); resetForm(); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.name || !form.host || !form.apiKey}>{editId ? 'Update' : 'Add'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={() => setDeleteId(null)}
        title="Delete Connection?"
        description="This will remove the server connection. Bots linked to this server will stop working."
        onConfirm={() => { if (deleteId) deleteServer.mutate(deleteId, { onSuccess: () => { toast.success('Connection deleted'); setDeleteId(null); } }); }}
        destructive
      />
    </div>
  );
}

function UsersTab() {
  const qc = useQueryClient();
  const { data: users, isLoading } = useQuery({ queryKey: ['users'], queryFn: usersApi.list });
  const createUser = useMutation({ mutationFn: (data: any) => usersApi.create(data), onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }) });
  const updateUser = useMutation({ mutationFn: ({ id, data }: { id: number; data: any }) => usersApi.update(id, data), onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }) });
  const deleteUser = useMutation({ mutationFn: (id: number) => usersApi.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }) });

  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [resetPwUserId, setResetPwUserId] = useState<number | null>(null);
  const [resetPwValue, setResetPwValue] = useState('');
  const [form, setForm] = useState({ username: '', password: '', displayName: '', role: 'viewer' });

  const userList = useMemo(() => (Array.isArray(users) ? users : []), [users]);

  if (isLoading) return <PageLoader />;

  const handleCreate = () => {
    createUser.mutate(form, {
      onSuccess: () => { toast.success('User created'); setShowAdd(false); setForm({ username: '', password: '', displayName: '', role: 'viewer' }); },
      onError: () => toast.error('Failed to create user'),
    });
  };

  const handleRoleChange = (userId: number, role: string) => {
    updateUser.mutate({ id: userId, data: { role } }, {
      onSuccess: () => toast.success('Role updated'),
      onError: () => toast.error('Failed to update role'),
    });
  };

  const handleToggleEnabled = (userId: number, enabled: boolean) => {
    updateUser.mutate({ id: userId, data: { enabled } }, {
      onSuccess: () => toast.success(enabled ? 'User enabled' : 'User disabled'),
      onError: () => toast.error('Failed to update status'),
    });
  };

  const handleResetPassword = () => {
    if (!resetPwUserId || resetPwValue.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    updateUser.mutate({ id: resetPwUserId, data: { password: resetPwValue } }, {
      onSuccess: () => { toast.success('Password reset successfully'); setResetPwUserId(null); setResetPwValue(''); },
      onError: () => toast.error('Failed to reset password'),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Manage webapp users and roles</p>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1" /> Add User</Button>
      </div>

      <div className="rounded-md border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="h-10 px-3 text-left font-medium text-muted-foreground">Username</th>
              <th className="h-10 px-3 text-left font-medium text-muted-foreground">Display Name</th>
              <th className="h-10 px-3 text-left font-medium text-muted-foreground">Role</th>
              <th className="h-10 px-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="h-10 px-3 text-right font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {userList.map((u: any) => {
              const isProtected = u.username === 'admin';
              return (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-2.5 font-mono-data text-xs">{u.username}</td>
                  <td className="px-3 py-2.5">{u.displayName}</td>
                  <td className="px-3 py-2.5">
                    {isProtected ? (
                      <Badge variant="default" className="text-[10px] capitalize">{u.role}</Badge>
                    ) : (
                      <Select value={u.role} onValueChange={(v) => handleRoleChange(u.id, v)}>
                        <SelectTrigger className="h-7 w-[110px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {isProtected ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                        <Check className="h-3 w-3" /> Active
                      </span>
                    ) : (
                      <Switch
                        checked={u.enabled}
                        onCheckedChange={(v) => handleToggleEnabled(u.id, v)}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="inline-flex items-center gap-0.5">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Reset Password" onClick={() => { setResetPwUserId(u.id); setResetPwValue(''); }}>
                        <KeyRound className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(u.id)} disabled={isProtected}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add User Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add User</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Username</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="johndoe" /></div>
            <div><Label className="text-xs">Display Name</Label><Input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="John Doe" /></div>
            <div><Label className="text-xs">Password</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="********" /></div>
            <div>
              <Label className="text-xs">Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!form.username || !form.password}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetPwUserId !== null} onOpenChange={(v) => { if (!v) { setResetPwUserId(null); setResetPwValue(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Reset Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Set a new password for <span className="font-medium text-foreground">{userList.find((u: any) => u.id === resetPwUserId)?.username}</span>
            </p>
            <div>
              <Label className="text-xs">New Password</Label>
              <Input type="password" value={resetPwValue} onChange={(e) => setResetPwValue(e.target.value)} placeholder="Min. 6 characters" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetPwUserId(null); setResetPwValue(''); }}>Cancel</Button>
            <Button onClick={handleResetPassword} disabled={resetPwValue.length < 6 || updateUser.isPending}>
              {updateUser.isPending ? 'Resetting...' : 'Reset Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={() => setDeleteId(null)}
        title="Delete User?"
        description="This user will be permanently deleted."
        onConfirm={() => { if (deleteId) deleteUser.mutate(deleteId, { onSuccess: () => { toast.success('User deleted'); setDeleteId(null); } }); }}
        destructive
      />
    </div>
  );
}
