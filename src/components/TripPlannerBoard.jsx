import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import axios from 'axios';

export default function TripPlannerBoard({ tripId, dayId }) {
  const [recommendations, setRecommendations] = useState([]);
  const [itinerary, setItinerary] = useState([]);
  const [loading, setLoading] = useState(true);

  // Cấu hình Axios instance tự động gắn Token từ localStorage
  const axiosInstance = axios.create({
    baseURL: 'http://localhost:8080', // Domain BE của bạn
  });

  axiosInstance.interceptors.request.use((config) => {
    // Lấy token từ nơi bạn lưu khi login (localStorage, sessionStorage, Redux...)
    const token = localStorage.getItem('token'); 
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // 1. Lấy dữ liệu đề xuất từ Backend
  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const response = await axiosInstance.get(`/api/v1/trips/${tripId}/recommendations/places`);
        setRecommendations(response.data);
      } catch (error) {
        console.error("Lỗi tải đề xuất:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchRecommendations();
  }, [tripId]);

  // 2. Ghi nhận sự kiện Xem chi tiết (VIEW)
  const handleViewPlace = async (placeId) => {
    // TODO: Hiện Popup chi tiết địa điểm tại đây
    await axiosInstance.post('/api/v1/recommendation-events', {
      tripId, placeId, eventType: 'VIEW'
    }).catch(console.error);
  };

  // 3. Ghi nhận sự kiện Bỏ qua (DISMISS)
  const handleDismiss = async (e, placeId) => {
    e.stopPropagation();
    setRecommendations(prev => prev.filter(p => p.placeId !== placeId));
    await axiosInstance.post('/api/v1/recommendation-events', {
      tripId, placeId, eventType: 'DISMISS'
    }).catch(console.error);
  };

  // 4. Xử lý Kéo - Thả vào Lịch trình (ADD_TO_TRIP)
  const onDragEnd = async (result) => {
    const { source, destination } = result;
    if (!destination || source.droppableId === destination.droppableId) return;

    if (source.droppableId === 'recommendations' && destination.droppableId === 'itinerary') {
      const movedItem = recommendations[source.index];

      // Cập nhật UI ngay lập tức (Optimistic UI)
      const newRecs = Array.from(recommendations);
      newRecs.splice(source.index, 1);
      const newItinerary = Array.from(itinerary);
      newItinerary.splice(destination.index, 0, movedItem);

      setRecommendations(newRecs);
      setItinerary(newItinerary);

      try {
        // Gọi API lưu vào bảng trip_destinations
        await axiosInstance.post(`/api/trips/days/${dayId}/destinations`, {
          placeId: movedItem.placeId,
          placeName: movedItem.name,
          itemType: movedItem.placeType,
          estimatedCost: movedItem.estimatedCostMin,
          orderIndex: destination.index
        });

        // Gọi API tracking AI
        await axiosInstance.post('/api/v1/recommendation-events', {
          tripId, 
          placeId: movedItem.placeId, 
          eventType: 'ADD_TO_TRIP',
          recommendationScore: movedItem.matchScore 
        });
      } catch (error) {
        console.error("Lỗi đồng bộ vào lịch trình:", error);
        // Có thể thêm logic rollback state ở đây nếu API lỗi
      }
    }
  };

  if (loading) return <div style={{ padding: '20px' }}>Đang phân tích dữ liệu AI...</div>;

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div style={{ display: 'flex', gap: '24px', padding: '20px', alignItems: 'flex-start' }}>
        
        {/* CỘT 1: AI ĐỀ XUẤT */}
        <div style={{ flex: 1, background: '#f8f9fa', padding: '20px', borderRadius: '12px' }}>
          <h3 style={{ marginTop: 0 }}>✨ Đề Xuất Phù Hợp ({recommendations.length})</h3>
          <Droppable droppableId="recommendations">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} style={{ minHeight: '400px' }}>
                {recommendations.map((item, index) => (
                  <Draggable key={`rec-${item.placeId}`} draggableId={`rec-${item.placeId}`} index={index}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        onClick={() => handleViewPlace(item.placeId)}
                        style={{
                          position: 'relative', padding: '16px', marginBottom: '12px', 
                          background: 'white', borderRadius: '8px', cursor: 'grab',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                          borderLeft: `4px solid ${item.matchScore > 0.6 ? '#4caf50' : '#ff9800'}`,
                          ...provided.draggableProps.style
                        }}
                      >
                        <button 
                          onClick={(e) => handleDismiss(e, item.placeId)}
                          style={{ position: 'absolute', top: '12px', right: '12px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#999', fontSize: '16px' }}
                        >
                          ✕
                        </button>
                        <strong style={{ display: 'block', fontSize: '16px', paddingRight: '24px' }}>{item.name}</strong>
                        
                        {/* Hiển thị Tags Sở thích */}
                        <div style={{ display: 'flex', gap: '6px', margin: '8px 0' }}>
                          {item.categories?.map(tag => (
                            <span key={tag} style={{ fontSize: '11px', background: '#e3f2fd', color: '#1976d2', padding: '4px 8px', borderRadius: '12px' }}>
                              {tag}
                            </span>
                          ))}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', fontSize: '13px' }}>
                          <span style={{ color: '#2e7d32', fontWeight: '600' }}>
                            {Math.round(item.matchScore * 100)}% Phù hợp
                          </span>
                          <span style={{ color: '#666' }}>
                            {item.estimatedCostMin === 0 ? 'Miễn phí' : `${item.estimatedCostMin.toLocaleString()} VNĐ`}
                          </span>
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </div>

        {/* CỘT 2: LỊCH TRÌNH */}
        <div style={{ flex: 1, background: '#e3f2fd', padding: '20px', borderRadius: '12px' }}>
          <h3 style={{ marginTop: 0 }}>📅 Lịch Trình (Ngày 1)</h3>
          <Droppable droppableId="itinerary">
            {(provided, snapshot) => (
              <div 
                ref={provided.innerRef} 
                {...provided.droppableProps} 
                style={{ 
                  minHeight: '400px', 
                  border: snapshot.isDraggingOver ? '2px dashed #2196f3' : '2px dashed transparent',
                  transition: 'border 0.2s'
                }}
              >
                {itinerary.length === 0 && <p style={{ color: '#666', textAlign: 'center', marginTop: '40px' }}>Kéo thả địa điểm vào đây...</p>}
                
                {itinerary.map((item, index) => (
                  <Draggable key={`iti-${item.placeId}`} draggableId={`iti-${item.placeId}`} index={index}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        style={{
                          padding: '16px', marginBottom: '12px', background: 'white',
                          borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                          ...provided.draggableProps.style
                        }}
                      >
                        <strong>{index + 1}. {item.name}</strong>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </div>

      </div>
    </DragDropContext>
  );
}