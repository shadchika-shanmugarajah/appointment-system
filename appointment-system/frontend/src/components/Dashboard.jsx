import React, { useEffect, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock, Calendar as CalendarIcon, Plus, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const formatDateForServer = (date) => {
  return date.toISOString().split('T')[0];
};

const Dashboard = () => {
  const { token } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [slots, setSlots] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newSlot, setNewSlot] = useState({
    date: new Date(),
    startTime: "09:00",
    endTime: "10:00",
  });

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [selectedDate, token]);

  const fetchData = async () => {
    if (!token) {
      setError("Authentication required");
      setLoading(false);
      return;
    }

    try {
      const [slotsRes, appointmentsRes] = await Promise.all([
        fetch('http://localhost:3001/api/slots', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch('http://localhost:3001/api/appointments', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      if (!slotsRes.ok || !appointmentsRes.ok) {
        throw new Error('Failed to fetch data');
      }
      
      const slotsData = await slotsRes.json();
      const appointmentsData = await appointmentsRes.json();
      console.log("slotsData",slotsData)

      setSlots(slotsData);
      setAppointments(appointmentsData);
      setError(null);
    } catch (error) {
      setError('Error fetching data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const createSlot = async () => {
    if (!token) {
      setError("Authentication required");
      return;
    }

    try {
      const formattedDate = formatDateForServer(newSlot.date);
      
      const res = await fetch('http://localhost:3001/api/slots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          date: formattedDate,
          start_time: newSlot.startTime,
          end_time: newSlot.endTime,
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to create slot');
      }

      setIsCreateDialogOpen(false);
      fetchData();
    } catch (error) {
      setError('Error creating slot: ' + error.message);
    }
  };

  const bookAppointment = async (slotId) => {
    if (!token) {
      setError("Authentication required");
      return;
    }

    try {
      const res = await fetch('http://localhost:3001/api/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ slot_id: slotId })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to book appointment');
      }

      fetchData();
    } catch (error) {
      setError('Error booking appointment: ' + error.message);
    }
  };

  const cancelAppointment = async (appointmentId) => {
    if (!token) {
      setError("Authentication required");
      return;
    }

    try {
      const res = await fetch(`http://localhost:3001/api/appointments/${appointmentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error('Failed to cancel appointment');
      }

      fetchData();
    } catch (error) {
      setError('Error cancelling appointment: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  const formatTimeString = (timeStr) => {
    // If timeStr is already in HH:MM format, return it as is
    if (typeof timeStr === 'string' && timeStr.includes(':')) {
      const [hours, minutes] = timeStr.split(':');
      return new Date(0, 0, 0, hours, minutes)
        .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    // If it's a timestamp or invalid, return empty string
    return '';
  };
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="w-96">
          <CardContent className="p-6">
            <p className="text-red-500 text-center">{error}</p>
            <Button 
              className="w-full mt-4"
              onClick={() => {
                setError(null);
                fetchData();
              }}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Booking Dashboard</h1>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-500 hover:bg-blue-600">
              <Plus className="w-4 h-4 mr-2" />
              Create Slot
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Booking Slot</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Calendar
                  mode="single"
                  selected={newSlot.date}
                  onSelect={(date) => setNewSlot({ ...newSlot, date })}
                  className="rounded-md border"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={newSlot.startTime}
                    onChange={(e) => setNewSlot({ ...newSlot, startTime: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={newSlot.endTime}
                    onChange={(e) => setNewSlot({ ...newSlot, endTime: e.target.value })}
                  />
                </div>
              </div>
              <Button className="w-full" onClick={createSlot}>
                Create Slot
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CalendarIcon className="w-5 h-5 mr-2" />
              Available Slots
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md border mb-4"
            />
            <div className="space-y-3">
              {slots
                .filter(slot => new Date(slot.date).toDateString() === selectedDate.toDateString())
                .map(slot => (
                  <Card key={slot.id}>
                    <CardContent className="p-4 flex justify-between items-center">
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-2 text-gray-500" />
                        <span className="font-medium">
                        {formatTimeString(slot.starttime)} - {formatTimeString(slot.endtime)}
                        </span>
                      </div>
                      <Button 
                        onClick={() => bookAppointment(slot.id)}
                        className="bg-blue-500 hover:bg-blue-600"
                      >
                        Book
                      </Button>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="w-5 h-5 mr-2" />
              Your Appointments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {appointments.map(appointment => (
                <Card key={appointment.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">
                          {new Date(appointment.date).toLocaleDateString(undefined, {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                        <p className="text-gray-500 flex items-center mt-1">
                          <Clock className="w-4 h-4 mr-2" />
                          {formatTimeString(appointment.starttime)} - {formatTimeString(appointment.endtime)}
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        onClick={() => cancelAppointment(appointment.id)}
                        className="bg-red-500 hover:bg-red-600"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;